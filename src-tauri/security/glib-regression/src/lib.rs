// Run on an isolated Linux CI runner: the affected API is not part of Windows.
#[cfg(all(test, target_os = "linux"))]
mod tests {
    use glib::variant::ToVariant;

    #[test]
    fn string_iterator_all_affected_methods_in_optimized_build() {
        let strings = ["first", "áéí 🗝️", "third", "fourth", "last"];
        let value = strings.as_slice().to_variant();
        // Exercise the upstream FFI out-pointer repeatedly with optimizations enabled.
        for _ in 0..2048 {
            let mut iter = value.array_iter_str().unwrap();
            assert_eq!(iter.next(), Some(strings[0]));
            assert_eq!(iter.next_back(), Some(strings[4]));
            assert_eq!(iter.nth(1), Some(strings[2]));
            assert_eq!(iter.nth_back(0), Some(strings[3]));
            assert_eq!(iter.next(), None);
            assert_eq!(iter.next_back(), None);
            assert_eq!(value.array_iter_str().unwrap().last(), Some(strings[4]));
            assert_eq!(value.array_iter_str().unwrap().nth_back(1), Some(strings[3]));
            assert_eq!(value.array_iter_str().unwrap().collect::<Vec<_>>(), strings);
            assert_eq!(value.array_iter_str().unwrap().rev().collect::<Vec<_>>(), strings.iter().copied().rev().collect::<Vec<_>>());
        }
    }

    #[test]
    fn empty_singleton_and_skips_keep_iterator_contract() {
        let empty = Vec::<String>::new().to_variant();
        let mut iter = empty.array_iter_str().unwrap();
        assert_eq!(iter.next(), None);
        assert_eq!(iter.next_back(), None);
        let single = ["único"].as_slice().to_variant();
        assert_eq!(single.array_iter_str().unwrap().last(), Some("único"));
        assert_eq!(single.array_iter_str().unwrap().next_back(), Some("único"));
        let mut skipped = single.array_iter_str().unwrap();
        assert_eq!(skipped.nth(usize::MAX), None);
        assert_eq!(skipped.next_back(), None);
    }
}
