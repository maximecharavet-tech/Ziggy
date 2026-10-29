//! MIT drop-in for the `option-ext` 0.2 API used by `dirs-sys`.

pub trait OptionExt<T> {
    /// `Some(v)` with `x == v`.
    #[must_use]
    fn contains<U>(&self, x: &U) -> bool
    where
        U: PartialEq<T>;

    /// `Option::map_or` with the arguments in the other order.
    #[must_use]
    fn map_or2<U, F: FnOnce(T) -> U>(self, f: F, default: U) -> U;

    /// `Option::map_or_else` with the arguments in the other order.
    #[must_use]
    fn map_or_else2<U, F: FnOnce(T) -> U, D: FnOnce() -> U>(self, f: F, default: D) -> U;
}

impl<T> OptionExt<T> for Option<T> {
    fn contains<U>(&self, x: &U) -> bool
    where
        U: PartialEq<T>,
    {
        matches!(self, Some(v) if x == v)
    }

    fn map_or2<U, F: FnOnce(T) -> U>(self, f: F, default: U) -> U {
        self.map_or(default, f)
    }

    fn map_or_else2<U, F: FnOnce(T) -> U, D: FnOnce() -> U>(self, f: F, default: D) -> U {
        self.map_or_else(default, f)
    }
}

#[cfg(test)]
mod tests {
    use super::OptionExt;

    #[test]
    fn behaves_like_option() {
        assert!(Some(3).contains(&3));
        assert!(!Some(3).contains(&4));
        assert!(!None::<i32>.contains(&3));
        assert_eq!(Some(2).map_or2(|v| v * 10, 0), 20);
        assert_eq!(None::<i32>.map_or2(|v| v * 10, 7), 7);
        assert_eq!(Some(2).map_or_else2(|v| v + 1, || 0), 3);
        assert_eq!(None::<i32>.map_or_else2(|v| v + 1, || 9), 9);
    }
}
