package utils

// ToPtr returns a pointer to v. Prefer the builtin new(expr) for plain
// expressions; ToPtr stays useful for named constants and explicit type
// arguments (e.g. ToPtr[int32](300)) where new(...) reads ambiguously.
func ToPtr[T any](v T) *T {
	return &v
}
