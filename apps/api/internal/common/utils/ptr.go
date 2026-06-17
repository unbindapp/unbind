package utils

func FromPtr[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}

func ToPtr[T any](v T) *T {
	return &v
}
