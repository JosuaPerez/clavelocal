use sha2::{Digest, Sha256};
use std::{sync::{Arc, Condvar, Mutex}, time::{Duration, Instant}};

fn validate_text(text: &str) -> Result<(), String> {
    if text.is_empty() || text.encode_utf16().count() > 4096 || text.contains('\0') {
        return Err("El texto debe tener de 1 a 4096 unidades UTF-16 y no contener NUL".into());
    }
    Ok(())
}

fn digest(text: &str) -> [u8; 32] { Sha256::digest(text.as_bytes()).into() }
fn matches(expected: &[u8; 32], current: &str) -> bool { *expected == digest(current) }
fn should_clear(expected: &[u8; 32], sequence: u32, current_sequence: u32, current: &str) -> bool {
    sequence == current_sequence && matches(expected, current)
}

trait ClipboardAccess {
    // Implementations must hold the OS clipboard lock across comparison and clear.
    fn wipe_matching(&self, expected: &[u8; 32], sequence: u32) -> Result<(), ()>;
}

#[derive(Clone)]
struct Pending { hash: [u8; 32], sequence: u32, deadline: Instant, attempts: u8 }
#[derive(Clone)]
pub struct SecretClipboard(Arc<(Mutex<Option<Pending>>, Condvar)>);

impl Default for SecretClipboard {
    fn default() -> Self {
        let this = Self(Arc::new((Mutex::new(None), Condvar::new())));
        let worker = this.clone();
        // One bounded worker, rather than a new sleeping thread per IPC call.
        std::thread::spawn(move || worker.run());
        this
    }
}

impl SecretClipboard {
    pub fn copy(&self, text: &str, owner: usize) -> Result<(), String> {
        validate_text(text)?;
        let (mutex, changed) = &*self.0;
        let mut pending = mutex.lock().map_err(|_| "No se pudo preparar el portapapeles")?;
        let hash = digest(text);
        let sequence = platform::copy(text, owner).map_err(|_| "No se pudo copiar con las protecciones de Windows. Inténtalo de nuevo.")?;
        *pending = Some(Pending { hash, sequence, deadline: Instant::now() + Duration::from_secs(30), attempts: 0 });
        changed.notify_one();
        Ok(())
    }

    pub fn wipe_now(&self) {
        let (mutex, _) = &*self.0;
        if let Ok(mut pending) = mutex.lock() {
            if let Some(item) = pending.as_ref() {
                if platform::SystemClipboard.wipe_matching(&item.hash, item.sequence).is_ok() { *pending = None; }
            }
        }
    }

    fn run(&self) {
        let (mutex, changed) = &*self.0;
        let Ok(mut pending) = mutex.lock() else { return; };
        loop {
            if let Some(item) = pending.as_ref() {
                let wait = item.deadline.saturating_duration_since(Instant::now());
                if wait.is_zero() {
                    if platform::SystemClipboard.wipe_matching(&item.hash, item.sequence).is_ok() || item.attempts >= 2 {
                        *pending = None;
                    } else if let Some(item) = pending.as_mut() {
                        item.attempts += 1;
                        item.deadline = Instant::now() + Duration::from_secs(1);
                    }
                    continue;
                }
                let Ok((guard, _)) = changed.wait_timeout(pending, wait) else { return; };
                pending = guard;
            } else {
                let Ok(guard) = changed.wait(pending) else { return; };
                pending = guard;
            }
        }
    }
}

#[cfg(windows)]
mod platform {
    use super::{should_clear, ClipboardAccess};
    use std::ptr;
    use windows_sys::Win32::{
        Foundation::{GlobalFree, HWND},
        System::{DataExchange::{OpenClipboard, CloseClipboard, EmptyClipboard, GetClipboardData,
            SetClipboardData, RegisterClipboardFormatW, GetClipboardSequenceNumber, IsClipboardFormatAvailable},
            Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GlobalSize, GMEM_MOVEABLE}},
    };
    const UNICODE_TEXT: u32 = 13;
    struct Open;
    impl Open {
        fn acquire(owner: HWND) -> Result<Self, ()> {
            for _ in 0..5 {
                // SAFETY: owner is a live Tauri window handle, or null for read/clear.
                if unsafe { OpenClipboard(owner) } != 0 { return Ok(Self); }
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            Err(())
        }
    }
    impl Drop for Open { fn drop(&mut self) { unsafe { CloseClipboard(); } } }

    // Transfers ownership only on success; Windows frees transferred moveable blocks.
    fn set(format: u32, bytes: &[u8]) -> Result<(), ()> {
        unsafe {
            let handle = GlobalAlloc(GMEM_MOVEABLE, bytes.len());
            if handle.is_null() { return Err(()); }
            let target = GlobalLock(handle).cast::<u8>();
            if target.is_null() { GlobalFree(handle); return Err(()); }
            // SAFETY: allocation is bytes.len() long and exclusively locked here.
            ptr::copy_nonoverlapping(bytes.as_ptr(), target, bytes.len());
            GlobalUnlock(handle);
            if SetClipboardData(format, handle).is_null() { GlobalFree(handle); return Err(()); }
        }
        Ok(())
    }

    pub fn copy(text: &str, owner: usize) -> Result<u32, ()> {
        if owner == 0 { return Err(()); }
        let _open = Open::acquire(owner as HWND)?;
        if unsafe { EmptyClipboard() } == 0 { return Err(()); }
        let result = (|| {
            // Set all opt-out formats before placing any secret on the clipboard.
            for name in ["ExcludeClipboardContentFromMonitorProcessing", "CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"] {
                let name: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
                let format = unsafe { RegisterClipboardFormatW(name.as_ptr()) };
                if format == 0 { return Err(()); }
                set(format, &0u32.to_le_bytes())?;
            }
            let bytes: Vec<u8> = text.encode_utf16().chain(Some(0)).flat_map(u16::to_le_bytes).collect();
            set(UNICODE_TEXT, &bytes)
        })();
        if result.is_err() { unsafe { EmptyClipboard(); } }
        result?;
        Ok(unsafe { GetClipboardSequenceNumber() })
    }

    pub struct SystemClipboard;
    impl ClipboardAccess for SystemClipboard {
        fn wipe_matching(&self, expected: &[u8; 32], sequence: u32) -> Result<(), ()> {
            let _open = Open::acquire(ptr::null_mut())?;
            // Under one OS lock: another app cannot replace data between read and clear.
            if unsafe { GetClipboardSequenceNumber() } != sequence { return Ok(()); }
            if unsafe { IsClipboardFormatAvailable(UNICODE_TEXT) } == 0 { return Ok(()); }
            let handle = unsafe { GetClipboardData(UNICODE_TEXT) };
            if handle.is_null() { return Err(()); }
            let size = unsafe { GlobalSize(handle) };
            // Bound reads of external clipboard data, and require terminated UTF-16.
            if size < 2 || size > 16384 || size % 2 != 0 { return Ok(()); }
            let data = unsafe { GlobalLock(handle) }.cast::<u8>();
            if data.is_null() { return Err(()); }
            // SAFETY: GlobalSize bounds the locked allocation; decode bytes without alignment assumptions.
            let bytes = unsafe { std::slice::from_raw_parts(data, size) };
            let units: Vec<u16> = bytes.chunks_exact(2).map(|b| u16::from_le_bytes([b[0], b[1]])).collect();
            let text = units.iter().position(|&u| u == 0).and_then(|end| String::from_utf16(&units[..end]).ok());
            unsafe { GlobalUnlock(handle); }
            if text.as_deref().is_some_and(|text| should_clear(expected, sequence, unsafe { GetClipboardSequenceNumber() }, text))
                && unsafe { EmptyClipboard() } == 0 { return Err(()); }
            Ok(())
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::ClipboardAccess;
    pub fn copy(_: &str, _: usize) -> Result<u32, ()> { Err(()) }
    pub struct SystemClipboard;
    impl ClipboardAccess for SystemClipboard {
        fn wipe_matching(&self, _: &[u8; 32], _: u32) -> Result<(), ()> { Err(()) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_size_unicode_and_nul() {
        assert!(validate_text(&"a".repeat(4096)).is_ok());
        assert!(validate_text(&"🗝".repeat(2048)).is_ok());
        for value in ["".into(), "a".repeat(4097), "🗝".repeat(2049), "a\0b".into()] { assert!(validate_text(&value).is_err()); }
    }
    #[test]
    fn digest_matches_only_original_text() {
        let hash = digest("ficticia");
        assert!(matches(&hash, "ficticia"));
        assert!(!matches(&hash, "otro texto"));
        assert!(!matches(&hash, "ficticia "));
    }
    #[test]
    fn clear_decision_preserves_replacement_even_with_identical_text() {
        let hash = digest("ficticia");
        assert!(should_clear(&hash, 7, 7, "ficticia"));
        assert!(!should_clear(&hash, 7, 7, "otro texto"));
        assert!(!should_clear(&hash, 7, 8, "ficticia"));
    }
}
