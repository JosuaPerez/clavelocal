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

    #[cfg(test)]
    mod native_tests {
        use super::*;
        use crate::clipboard::SecretClipboard;
        use std::time::{Duration, Instant};
        use windows_sys::Win32::UI::WindowsAndMessaging::{CreateWindowExW, DestroyWindow};

        struct TestWindow(HWND);
        impl Drop for TestWindow {
            fn drop(&mut self) {
                if let Ok(_open) = Open::acquire(self.0) { unsafe { EmptyClipboard(); } }
                unsafe { DestroyWindow(self.0); }
            }
        }
        fn text() -> Option<String> {
            let _open = Open::acquire(ptr::null_mut()).expect("open isolated clipboard");
            if unsafe { IsClipboardFormatAvailable(UNICODE_TEXT) } == 0 { return None; }
            let handle = unsafe { GetClipboardData(UNICODE_TEXT) };
            assert!(!handle.is_null());
            let size = unsafe { GlobalSize(handle) };
            assert!(size >= 2 && size <= 16384 && size % 2 == 0);
            let data = unsafe { GlobalLock(handle) }.cast::<u8>();
            assert!(!data.is_null());
            let bytes = unsafe { std::slice::from_raw_parts(data, size) };
            let units: Vec<u16> = bytes.chunks_exact(2).map(|b| u16::from_le_bytes([b[0], b[1]])).collect();
            let end = units.iter().position(|&u| u == 0).expect("terminated text");
            let result = String::from_utf16(&units[..end]).expect("valid UTF-16");
            unsafe { GlobalUnlock(handle); }
            Some(result)
        }

        // This changes the system clipboard. It is explicitly opted into only on
        // the ephemeral Windows CI runner, never on the maintainer's desktop.
        #[test]
        #[ignore = "run explicitly on the isolated Windows CI runner"]
        fn isolated_windows_clipboard_roundtrip_and_cleanup() {
            assert_eq!(std::env::var("GITHUB_ACTIONS").as_deref(), Ok("true"));
            assert_eq!(std::env::var("RUNNER_OS").as_deref(), Ok("Windows"));
            let class: Vec<u16> = "STATIC".encode_utf16().chain(Some(0)).collect();
            let handle = unsafe {
                CreateWindowExW(0, class.as_ptr(), class.as_ptr(), 0, 0, 0, 0, 0,
                    ptr::null_mut(), ptr::null_mut(), ptr::null_mut(), ptr::null())
            };
            assert!(!handle.is_null(), "hidden test window creation");
            let window = TestWindow(handle);
            let clipboard = SecretClipboard::default();
            clipboard.copy("solo-prueba-nativa-🗝️", window.0 as usize).unwrap();
            assert_eq!(text().as_deref(), Some("solo-prueba-nativa-🗝️"));
            {
                let _open = Open::acquire(ptr::null_mut()).unwrap();
                for format in ["ExcludeClipboardContentFromMonitorProcessing", "CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"] {
                    let name: Vec<u16> = format.encode_utf16().chain(Some(0)).collect();
                    let id = unsafe { RegisterClipboardFormatW(name.as_ptr()) };
                    let value = unsafe { GetClipboardData(id) };
                    assert!(!value.is_null(), "missing exclusion format: {format}");
                    assert!(unsafe { GlobalSize(value) } >= 4);
                    let data = unsafe { GlobalLock(value) }.cast::<u8>();
                    assert!(!data.is_null());
                    assert_eq!(unsafe { std::slice::from_raw_parts(data, 4) }, &[0, 0, 0, 0]);
                    unsafe { GlobalUnlock(value); }
                }
            }
            // Same path used by the normal close/exit callbacks.
            clipboard.wipe_now();
            assert_eq!(text(), None, "close cleanup clears the copied secret");
            clipboard.copy("ficticia-original", window.0 as usize).unwrap();
            copy("otro-texto-del-usuario", window.0 as usize).unwrap();
            clipboard.wipe_now();
            assert_eq!(text().as_deref(), Some("otro-texto-del-usuario"));
            clipboard.copy("ficticia-temporizador", window.0 as usize).unwrap();
            let deadline = Instant::now() + Duration::from_secs(40);
            while text().is_some() && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(100));
            }
            assert_eq!(text(), None, "native worker clears without a UI callback");
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
