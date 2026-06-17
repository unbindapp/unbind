package pkgmanager

import (
	"context"
	"fmt"
)

// ProgressFunc callback for install progress updates
type ProgressFunc func(packageName string, progress float64, step string, isComplete bool)

// PackageManager common interface for diff pkg systems
type PackageManager interface {
	// InstallPackages installs the specified packages
	// The operation can be cancelled using the provided context
	InstallPackages(ctx context.Context, packages []string, progressFunc ProgressFunc) error
}

// NewPackageManager factory based on distro type
func NewPackageManager(distribution string, logChan chan<- string) (PackageManager, error) {
	switch distribution {
	case "ubuntu", "debian":
		return NewAptInstaller(logChan), nil
	case "fedora", "centos", "rocky", "almalinux":
		return NewDNFInstaller(logChan), nil
	case "opensuse":
		return NewZypperInstaller(logChan), nil
	default:
		return nil, fmt.Errorf("unsupported distribution: %s", distribution)
	}
}
