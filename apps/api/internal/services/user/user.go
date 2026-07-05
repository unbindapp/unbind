package user_service

import (
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate user management with internal permissions
type UserService struct {
	repo repositories.RepositoriesInterface
}

func NewUserService(repo repositories.RepositoriesInterface) *UserService {
	return &UserService{
		repo: repo,
	}
}
