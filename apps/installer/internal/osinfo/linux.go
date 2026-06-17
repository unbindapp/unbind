package osinfo

import (
	"bufio"
	"os"
	"strings"

	"github.com/unbindapp/unbind-installer/internal/errdefs"
)

// osOpen is a variable that points to os.Open to allow mocking in tests
var osOpen = os.Open

// detectLinuxDistro attempts to identify the Linux distribution and version
func detectLinuxDistro(info *OSInfo) error {
	// Check for /etc/os-release first (most modern Linux distributions)
	if err := readOSRelease(info); err == nil {
		return nil
	}

	return errdefs.NewCustomError(errdefs.ErrTypeDistributionDetectionFailed, "Failed to detect Linux distribution")
}

// readOSRelease reads distribution information from /etc/os-release
func readOSRelease(info *OSInfo) error {
	file, err := osOpen("/etc/os-release")
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := parts[0]
		value := strings.Trim(parts[1], "\"")

		switch key {
		case "ID":
			if value == "opensuse-leap" {
				value = "opensuse"
			}
			info.Distribution = value
		case "VERSION_ID":
			info.VersionID = value
		case "VERSION":
			info.Version = value
		case "PRETTY_NAME":
			info.PrettyName = value
		}
	}

	return scanner.Err()
}
