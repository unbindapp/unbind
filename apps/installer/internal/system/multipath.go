package system

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

const multipathConfPath = "/etc/multipath.conf"
const multipathKBURL = "https://longhorn.io/kb/troubleshooting-volume-with-multipath/"

// Longhorn exports volumes through tgt without an identity, so they inherit tgt's defaults.
const longhornDeviceBlacklist = "device {\n        vendor \"IET\"\n        product \"VIRTUAL-DISK\"\n    }"

var blacklistSectionLine = regexp.MustCompile(`(?m)^[ \t]*blacklist[ \t]*\{.*$`)
var longhornVendor = regexp.MustCompile(`vendor[ \t]+"IET"`)
var longhornProduct = regexp.MustCompile(`product[ \t]+"VIRTUAL-DISK"`)

func EnsureMultipathBlacklist(conf string) (string, bool) {
	if longhornVendor.MatchString(conf) && longhornProduct.MatchString(conf) {
		return conf, false
	}
	loc := blacklistSectionLine.FindStringIndex(conf)
	if loc == nil || strings.Contains(conf[loc[0]:loc[1]], "}") {
		return appendBlacklistSection(conf), true
	}
	return conf[:loc[1]] + "\n    " + longhornDeviceBlacklist + conf[loc[1]:], true
}

func appendBlacklistSection(conf string) string {
	section := "blacklist {\n    " + longhornDeviceBlacklist + "\n}\n"
	if conf == "" {
		return section
	}
	if !strings.HasSuffix(conf, "\n") {
		conf += "\n"
	}
	return conf + "\n" + section
}

func ConfigureMultipathBlacklist(logChan chan<- string) error {
	if _, err := exec.LookPath("multipathd"); err != nil {
		nbSend(logChan, "multipathd is not installed, skipping multipath blacklist")
		return nil
	}

	if hasMultipathMaps(logChan) {
		nbSend(logChan, "Warning: this host uses multipath, leaving "+multipathConfPath+" alone. Blacklist Longhorn devices yourself: "+multipathKBURL)
		return nil
	}

	current, err := os.ReadFile(multipathConfPath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("failed to read %s: %w", multipathConfPath, err)
	}

	updated, changed := EnsureMultipathBlacklist(string(current))
	if !changed {
		nbSend(logChan, multipathConfPath+" already blacklists Longhorn devices")
		return nil
	}

	if err := os.WriteFile(multipathConfPath, []byte(updated), 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", multipathConfPath, err)
	}
	nbSend(logChan, "Blacklisted Longhorn devices from multipathd in "+multipathConfPath)

	return restartMultipathdIfActive(logChan)
}

func hasMultipathMaps(logChan chan<- string) bool {
	out, err := runCommand(nil, "multipath", "-ll")
	if err != nil {
		nbSend(logChan, "multipath -ll failed, assuming no multipath maps: "+err.Error())
		return false
	}
	return strings.TrimSpace(out) != ""
}

func restartMultipathdIfActive(logChan chan<- string) error {
	if _, err := runCommand(nil, "systemctl", "is-active", "--quiet", "multipathd"); err != nil {
		nbSend(logChan, "multipathd is not running, no restart needed")
		return nil
	}
	_, err := runCommand(logChan, "systemctl", "restart", "multipathd")
	return err
}
