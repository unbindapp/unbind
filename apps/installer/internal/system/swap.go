package system

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/unbindapp/unbind-installer/internal/errdefs"
)

const swapFilePath = "/swapfile"
const fstabPath = "/etc/fstab"
const sysctlConfPath = "/etc/sysctl.d/99-swap-tuning.conf" // Dedicated conf file

func runCommand(logChan chan<- string, name string, args ...string) (string, error) {
	cmdStr := name + " " + strings.Join(args, " ")
	if logChan != nil {
		logChan <- fmt.Sprintf("Executing: %s", cmdStr)
	}

	cmd := exec.Command(name, args...)
	var stdOut, stdErr bytes.Buffer
	cmd.Stdout = &stdOut
	cmd.Stderr = &stdErr

	err := cmd.Run()

	stdoutStr := stdOut.String()
	stderrStr := stdErr.String()

	if logChan != nil {
		if len(stdoutStr) > 0 {
			logChan <- fmt.Sprintf("Stdout from '%s':\n%s", cmdStr, stdoutStr)
		}
		if len(stderrStr) > 0 || err != nil {
			logChan <- fmt.Sprintf("Stderr from '%s':\n%s", cmdStr, stderrStr)
		}
	}

	if err != nil {
		errMsg := fmt.Sprintf("failed to execute '%s': %v. Stderr: %s", cmdStr, err, stderrStr)
		if logChan != nil {
			logChan <- fmt.Sprintf("Error executing '%s': %v", cmdStr, err)
		}
		return stdoutStr, fmt.Errorf(errMsg)
	}

	if logChan != nil {
		logChan <- fmt.Sprintf("Successfully executed: %s", cmdStr)
	}
	return stdoutStr, nil
}

func CheckSwapActive(logChan chan<- string) (bool, error) {
	if logChan != nil {
		logChan <- "Checking active swap using /proc/swaps..."
	}
	file, err := os.Open("/proc/swaps")
	if err != nil {
		if os.IsNotExist(err) {
			if logChan != nil {
				logChan <- "/proc/swaps does not exist, assuming no swap."
			}
			return false, nil
		}
		return false, fmt.Errorf("failed to open /proc/swaps: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineCount := 0
	for scanner.Scan() {
		lineCount++
		// The first line is headers, more than one line means swap is active.
		if lineCount > 1 {
			if logChan != nil {
				logChan <- "Found active swap entry in /proc/swaps."
			}
			return true, nil
		}
	}

	if err := scanner.Err(); err != nil {
		return false, fmt.Errorf("error reading /proc/swaps: %w", err)
	}

	if logChan != nil {
		logChan <- "No active swap entries found in /proc/swaps."
	}
	return false, nil
}

func GetAvailableDiskSpaceGB(logChan chan<- string) (float64, error) {
	if logChan != nil {
		logChan <- "Checking available disk space on / filesystem..."
	}
	// Use df -k to get output in kilobytes, targeting the root filesystem
	// Using P flag to avoid issues with long device names wrapping lines
	stdout, err := runCommand(logChan, "df", "-Pk", "/")
	if err != nil {
		return 0, fmt.Errorf("failed to run df command: %w", err)
	}

	// Parse the output
	lines := strings.Split(stdout, "\n")
	if len(lines) < 2 {
		return 0, fmt.Errorf("unexpected output format from df: too few lines")
	}

	// Find the header line to locate the "Available" column index
	header := regexp.MustCompile(`\s+`).Split(strings.TrimSpace(lines[0]), -1)
	availIndex := -1
	for i, h := range header {
		if h == "Available" {
			availIndex = i
			break
		}
	}
	if availIndex == -1 {
		return 0, fmt.Errorf("could not find 'Available' column in df output header: %s", lines[0])
	}

	// Parse the data line (second line should be the root fs info)
	fields := regexp.MustCompile(`\s+`).Split(strings.TrimSpace(lines[1]), -1)
	if len(fields) <= availIndex {
		return 0, fmt.Errorf("unexpected output format from df data line: not enough fields. Line: %s", lines[1])
	}

	availableKBStr := fields[availIndex]
	availableKB, err := strconv.ParseUint(availableKBStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse available kilobytes '%s': %w", availableKBStr, err)
	}

	// Convert KB to GB
	availableGB := float64(availableKB) / (1024 * 1024)
	if logChan != nil {
		logChan <- fmt.Sprintf("Available disk space: %.2f GB", availableGB)
	}
	return availableGB, nil
}

// applySysctlSettings manages kernel settings for swap
func applySysctlSettings(logChan chan<- string, settings map[string]string, confFile string) error {
	logChan <- fmt.Sprintf("Applying sysctl settings to %s...", confFile)
	needsUpdate := false // Flag to track if sysctl -p needs running

	// Ensure the directory exists
	confDir := "/etc/sysctl.d"
	if _, err := os.Stat(confDir); os.IsNotExist(err) {
		logChan <- fmt.Sprintf("Creating directory %s", confDir)
		if err := os.MkdirAll(confDir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", confDir, err)
		}
		needsUpdate = true // Directory created, file will be new
	} else if err != nil {
		return fmt.Errorf("failed to stat directory %s: %w", confDir, err)
	}

	// Read existing file content
	existingLines := []string{}
	file, err := os.Open(confFile)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to open %s for reading: %w", confFile, err)
	}
	if err == nil { // File exists
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			existingLines = append(existingLines, scanner.Text())
		}
		file.Close()
		if err := scanner.Err(); err != nil {
			return fmt.Errorf("failed to read existing %s: %w", confFile, err)
		}
	} else {
		// File doesn't exist, will need creation
		needsUpdate = true
	}

	// Process settings: Update existing lines or mark for appending
	updatedLines := []string{}
	processedKeys := make(map[string]bool) // Track which settings were found/updated

	for _, line := range existingLines {
		trimmedLine := strings.TrimSpace(line)
		// Skip comments and empty lines
		if strings.HasPrefix(trimmedLine, "#") || trimmedLine == "" {
			updatedLines = append(updatedLines, line)
			continue
		}

		parts := regexp.MustCompile(`\s*=\s*`).Split(trimmedLine, 2)
		if len(parts) != 2 {
			updatedLines = append(updatedLines, line) // Keep malformed lines as is
			continue
		}
		key := strings.TrimSpace(parts[0])
		currentValue := strings.TrimSpace(parts[1])

		// Check if this is one of the keys we want to manage
		if desiredValue, ok := settings[key]; ok {
			processedKeys[key] = true
			if currentValue != desiredValue {
				logChan <- fmt.Sprintf("Updating sysctl '%s': '%s' -> '%s' in %s", key, currentValue, desiredValue, confFile)
				updatedLines = append(updatedLines, fmt.Sprintf("%s = %s", key, desiredValue))
				needsUpdate = true
			} else {
				logChan <- fmt.Sprintf("Sysctl '%s = %s' already correctly set in %s", key, currentValue, confFile)
				updatedLines = append(updatedLines, line) // Keep the existing line
			}
		} else {
			// Keep lines for parameters we don't manage
			updatedLines = append(updatedLines, line)
		}
	}

	// Append settings that were not found in the existing file
	for key, value := range settings {
		if !processedKeys[key] {
			logChan <- fmt.Sprintf("Adding sysctl '%s = %s' to %s", key, value, confFile)
			updatedLines = append(updatedLines, fmt.Sprintf("%s = %s", key, value))
			needsUpdate = true
		}
	}

	// Write the updated content back if changes were made
	if needsUpdate {
		logChan <- fmt.Sprintf("Writing updated configuration to %s...", confFile)
		// Write to temp file first, then rename for atomicity
		tempFile, err := os.CreateTemp(confDir, fmt.Sprintf("%s.tmp", "99-unbind-k3s-tuning"))
		if err != nil {
			return fmt.Errorf("failed to create temp file for sysctl config: %w", err)
		}
		tempFilePath := tempFile.Name()

		writer := bufio.NewWriter(tempFile)
		for _, line := range updatedLines {
			if _, err := writer.WriteString(line + "\n"); err != nil {
				tempFile.Close()
				os.Remove(tempFilePath) // Clean up temp file
				return fmt.Errorf("failed to write line to temp sysctl config %s: %w", tempFilePath, err)
			}
		}
		if err := writer.Flush(); err != nil {
			tempFile.Close()
			os.Remove(tempFilePath)
			return fmt.Errorf("failed to flush temp sysctl config %s: %w", tempFilePath, err)
		}
		if err := tempFile.Close(); err != nil {
			os.Remove(tempFilePath)
			return fmt.Errorf("failed to close temp sysctl config %s: %w", tempFilePath, err)
		}

		// Set correct permissions before rename
		if err := os.Chmod(tempFilePath, 0644); err != nil {
			os.Remove(tempFilePath)
			return fmt.Errorf("failed to chmod temp sysctl config %s: %w", tempFilePath, err)
		}

		// Rename temp file to final destination
		if err := os.Rename(tempFilePath, confFile); err != nil {
			os.Remove(tempFilePath)
			return fmt.Errorf("failed to rename temp sysctl config %s to %s: %w", tempFilePath, confFile, err)
		}
		logChan <- fmt.Sprintf("Successfully wrote sysctl configuration to %s", confFile)

		// Apply the settings using sysctl -p <file>
		logChan <- fmt.Sprintf("Applying sysctl settings from %s...", confFile)
		if _, err := runCommand(logChan, "sysctl", "-p", confFile); err != nil {
			// Log as warning, swap is already active, sysctl can be applied manually later
			logChan <- fmt.Sprintf("Warning: Failed to apply sysctl settings via 'sysctl -p %s': %v", confFile, err)
			logChan <- "Settings were written to the file but might require a reboot or manual 'sysctl -p' to take effect."
		} else {
			logChan <- "Sysctl settings applied successfully."
		}
	} else {
		logChan <- fmt.Sprintf("No changes needed for sysctl settings in %s.", confFile)
	}

	return nil
}

// CreateSwapFile sets up and enables a system swap file
func CreateSwapFile(sizeGB int, logChan chan<- string) error {
	if os.Geteuid() != 0 {
		return errdefs.ErrNotRoot // Ensure we run as root
	}
	if sizeGB <= 0 {
		return fmt.Errorf("swap size must be positive")
	}

	sizeBytes := int64(sizeGB) * 1024 * 1024 * 1024
	sizeHuman := fmt.Sprintf("%dG", sizeGB)

	logChan <- fmt.Sprintf("Attempting to create %s swap file at %s...", sizeHuman, swapFilePath)

	// 1. Check/Remove existing swapfile
	if _, err := os.Stat(swapFilePath); err == nil {
		logChan <- fmt.Sprintf("Warning: %s already exists. Attempting to remove it first.", swapFilePath)
		if _, errRem := runCommand(logChan, "rm", "-f", swapFilePath); errRem != nil {
			// Attempt to turn off swap if remove fails (might be in use)
			logChan <- fmt.Sprintf("Failed to remove %s, attempting swapon -d %s", swapFilePath, swapFilePath)
			_, _ = runCommand(logChan, "swapoff", swapFilePath) // Ignore error, try remove again
			if _, errRem2 := runCommand(logChan, "rm", "-f", swapFilePath); errRem2 != nil {
				return fmt.Errorf("failed to remove existing swapfile %s even after swapoff attempt: %w", swapFilePath, errRem2)
			}
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("error checking for existing swapfile %s: %w", swapFilePath, err)
	}

	// 2. Create file (fallocate with dd fallback)
	logChan <- fmt.Sprintf("Allocating %s space for %s...", sizeHuman, swapFilePath)
	if _, err := runCommand(logChan, "fallocate", "-l", fmt.Sprintf("%dB", sizeBytes), swapFilePath); err != nil {
		logChan <- "fallocate failed, attempting fallback using dd (this might take a while)..."
		ddCmd := fmt.Sprintf("dd if=/dev/zero of=%s bs=1M count=%d status=progress", swapFilePath, sizeGB*1024)
		logChan <- fmt.Sprintf("Executing: %s", ddCmd)
		cmd := exec.Command("bash", "-c", ddCmd)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if errDd := cmd.Run(); errDd != nil {
			_ = os.Remove(swapFilePath)
			return fmt.Errorf("dd fallback failed to create swapfile %s: %w", swapFilePath, errDd)
		}
	}

	// 3. Set permissions
	logChan <- fmt.Sprintf("Setting permissions (600) for %s...", swapFilePath)
	if _, err := runCommand(logChan, "chmod", "600", swapFilePath); err != nil {
		return fmt.Errorf("failed to set permissions on %s: %w", swapFilePath, err)
	}

	// 4. Format as swap
	logChan <- fmt.Sprintf("Formatting %s as swap...", swapFilePath)
	if _, err := runCommand(logChan, "mkswap", swapFilePath); err != nil {
		return fmt.Errorf("failed to format %s as swap: %w", swapFilePath, err)
	}

	// 5. Activate swap
	logChan <- fmt.Sprintf("Activating swap on %s...", swapFilePath)
	if _, err := runCommand(logChan, "swapon", swapFilePath); err != nil {
		return fmt.Errorf("failed to activate swap on %s: %w", swapFilePath, err)
	}

	// 6. Add to /etc/fstab
	logChan <- fmt.Sprintf("Adding swap entry to %s...", fstabPath)
	fstabEntry := fmt.Sprintf("%s none swap sw 0 0", swapFilePath)
	entryExists := false
	f, err := os.Open(fstabPath)
	if err != nil {
		return fmt.Errorf("failed to open %s for reading: %w", fstabPath, err)
	}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == strings.TrimSpace(fstabEntry) || (strings.Contains(line, swapFilePath) && strings.Contains(line, "swap")) {
			entryExists = true
			break
		}
	}
	f.Close()
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading %s: %w", fstabPath, err)
	}

	if !entryExists {
		logChan <- fmt.Sprintf("Appending entry to %s: '%s'", fstabPath, fstabEntry)
		fstabFile, err := os.OpenFile(fstabPath, os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return fmt.Errorf("failed to open %s for appending: %w", fstabPath, err)
		}

		info, _ := fstabFile.Stat()
		needsNewline := false
		if info.Size() > 0 {
			buf := make([]byte, 1)
			_, errRead := fstabFile.ReadAt(buf, info.Size()-1)
			if errRead == nil && string(buf) != "\n" {
				needsNewline = true
			}
		}
		if needsNewline {
			if _, err := fstabFile.WriteString("\n"); err != nil {
				fstabFile.Close()
				return fmt.Errorf("failed to write newline to %s: %w", fstabPath, err)
			}
		}

		if _, err := fstabFile.WriteString(fstabEntry + "\n"); err != nil {
			fstabFile.Close()
			return fmt.Errorf("failed to append swap entry to %s: %w", fstabPath, err)
		}
		fstabFile.Close()
		logChan <- "Successfully appended swap entry to fstab."
	} else {
		logChan <- "Swap entry already exists in fstab or a conflicting entry was found. Skipping append."
	}

	// Calculate min_free_kbytes
	minFreeKbytes, err := calculateMinFreeKbytes(logChan)
	if err != nil {
		logChan <- fmt.Sprintf("Warning: Failed to calculate min_free_kbytes: %v", err)
	}

	// Apply Sysctl Settings
	desiredSettings := map[string]string{
		"vm.swappiness":             "1",  // Recommended for K8s
		"vm.vfs_cache_pressure":     "50", // Common tuning parameter
		"vm.watermark_scale_factor": "10",
		"vm.overcommit_memory":      "1",
		"vm.overcommit_ratio":       "80",
		"vm.dirty_ratio":            "15",
		"vm.dirty_background_ratio": "5",
	}
	if minFreeKbytes != "" {
		desiredSettings["vm.min_free_kbytes"] = minFreeKbytes
	}
	if err := applySysctlSettings(logChan, desiredSettings, sysctlConfPath); err != nil {
		// Log as a warning, swap creation itself succeeded
		logChan <- fmt.Sprintf("Warning: Failed to apply sysctl settings: %v", err)
		logChan <- "Swap file setup succeeded, but sysctl tuning failed. Manual configuration might be needed."
	}

	logChan <- "Swap file created, activated, and tuned successfully."
	return nil
}

// Calculate swap min_free_kbytes as 1-2% of total RAM
func calculateMinFreeKbytes(logChan chan<- string) (string, error) {
	// Read total memory from /proc/meminfo
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return "", fmt.Errorf("failed to open /proc/meminfo: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var totalMemKB uint64

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				totalMemKB, err = strconv.ParseUint(fields[1], 10, 64)
				if err != nil {
					return "", fmt.Errorf("failed to parse MemTotal: %w", err)
				}
				break
			}
		}
	}

	if totalMemKB == 0 {
		return "", fmt.Errorf("could not find MemTotal in /proc/meminfo")
	}

	var percentage float64
	if totalMemKB > 4*1024*1024 { // >4GB
		percentage = 0.01 // 1%
	} else {
		percentage = 0.02 // 2%
	}

	minFreeKB := uint64(float64(totalMemKB) * percentage)

	// Set boundaries
	const minAbsolute = 16384  // 16MB minimum
	const maxAbsolute = 262144 // 256MB maximum

	if minFreeKB < minAbsolute {
		minFreeKB = minAbsolute
	} else if minFreeKB > maxAbsolute {
		minFreeKB = maxAbsolute
	}

	if logChan != nil {
		logChan <- fmt.Sprintf("Calculated min_free_kbytes: %d KB (%.1f%% of %d KB total RAM)",
			minFreeKB, percentage*100, totalMemKB)
	}

	return strconv.FormatUint(minFreeKB, 10), nil
}
