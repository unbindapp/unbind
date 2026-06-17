package k3s

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/unbindapp/unbind-installer/internal/errdefs"
)

const (
	// K3sUninstallScriptPath is the default location of the K3s uninstall script.
	K3sUninstallScriptPath = "/usr/local/bin/k3s-uninstall.sh"
)

// CheckResult holds the result of the K3s check.
type CheckResult struct {
	IsInstalled     bool
	UninstallScript string // Path to the uninstall script if found
}

// CheckInstalled checks if a K3s installation (specifically the uninstall script) exists.
func CheckInstalled() (*CheckResult, error) {
	result := &CheckResult{}

	// Check for server uninstall script
	if _, err := os.Stat(K3sUninstallScriptPath); err == nil {
		result.IsInstalled = true
		result.UninstallScript = K3sUninstallScriptPath
		return result, nil
	} else if !os.IsNotExist(err) {
		// Other error (e.g., permissions)
		return nil, fmt.Errorf("error checking for %s: %w", K3sUninstallScriptPath, err)
	}

	// Not found
	result.IsInstalled = false
	return result, nil
}

// runCommand executes an external command and logs its output.
func runCommand(logChan chan<- string, command string, args ...string) error {
	cmdStr := command + " " + strings.Join(args, " ")
	logChan <- fmt.Sprintf("Executing: %s", cmdStr)

	cmd := exec.Command(command, args...)
	var stdOut, stdErr bytes.Buffer
	cmd.Stdout = &stdOut
	cmd.Stderr = &stdErr

	err := cmd.Run()

	if stdOut.Len() > 0 {
		logChan <- fmt.Sprintf("Stdout from '%s':\n%s", cmdStr, stdOut.String())
	}
	// Log stderr only if there's an error or stderr output exists
	if err != nil || stdErr.Len() > 0 {
		logChan <- fmt.Sprintf("Stderr from '%s':\n%s", cmdStr, stdErr.String())
	}

	if err != nil {
		logChan <- fmt.Sprintf("Error executing '%s': %v", cmdStr, err)
		return fmt.Errorf("failed to execute '%s': %w", cmdStr, err)
	}

	logChan <- fmt.Sprintf("Successfully executed: %s", cmdStr)
	return nil
}

// Uninstall executes the K3s uninstall script.
func Uninstall(uninstallScriptPath string, logChan chan<- string) error {
	var err error
	if os.Geteuid() != 0 {
		return errdefs.ErrNotRoot // Ensure we run as root
	}
	if _, err := os.Stat(uninstallScriptPath); os.IsNotExist(err) {
		return fmt.Errorf("k3s uninstall script not found at %s", uninstallScriptPath)
	}

	// Longhorn uninstall process
	logChan <- "Starting Longhorn uninstall process..."

	// Set KUBECONFIG for kubectl commands
	os.Setenv("KUBECONFIG", "/etc/rancher/k3s/k3s.yaml")

	// Set flag to allow uninstall
	err = runCommand(logChan, "kubectl", "patch", "-n", "longhorn-system", "settings.longhorn.io", "deleting-confirmation-flag", "-p", `{"value":"true"}`, "--type=merge")
	if err != nil {
		logChan <- "Warning: Failed to set Longhorn deleting-confirmation-flag, continuing anyway"
	}

	// Create Longhorn uninstall job
	err = runCommand(logChan, "kubectl", "create", "-f", "https://raw.githubusercontent.com/longhorn/longhorn/v1.9.0/uninstall/uninstall.yaml")
	if err != nil {
		logChan <- "Warning: Failed to create Longhorn uninstall job, continuing anyway"
	}

	// Wait for uninstall job with timeout
	timeout := time.After(300 * time.Second)
	tick := time.Tick(5 * time.Second)
	for {
		select {
		case <-timeout:
			logChan <- "Warning: Longhorn uninstall job timed out, continuing anyway"
			goto cleanup
		case <-tick:
			cmd := exec.Command("kubectl", "-n", "longhorn-system", "get", "job", "longhorn-uninstall", "-o", "jsonpath={.status.conditions[?(@.type=='Complete')].status}")
			output, err := cmd.Output()
			if err == nil && strings.TrimSpace(string(output)) == "True" {
				logChan <- "Longhorn uninstall job completed successfully"
				goto cleanup
			}
		}
	}
cleanup:
	// Give Longhorn time to uninstall
	time.Sleep(10 * time.Second)

	// 1. Log out of any leftover iSCSI sessions
	err = runCommand(logChan, "iscsiadm", "-m", "session", "|", "grep", "'io.longhorn'", "|", "awk", "'{print $2}'", "|", "sed", "'s/\\[\\([0-9]*\\)\\]/\\1/'", "|", "xargs", "-r", "-I{}", "iscsiadm", "-m", "session", "-u", "-r", "{}")
	if err != nil {
		logChan <- "Warning: Failed to logout of iSCSI sessions, continuing anyway"
	}

	err = runCommand(logChan, "iscsiadm", "-m", "node", "--targetname", "iqn.*.longhorn*", "-o", "delete")
	if err != nil {
		logChan <- "Warning: Failed to delete iSCSI nodes, continuing anyway"
	}

	// 2. Remove device-mapper entries
	cmd := exec.Command("dmsetup", "ls")
	output, err := cmd.Output()
	if err == nil {
		scanner := bufio.NewScanner(bytes.NewReader(output))
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, "longhorn") {
				dev := strings.Fields(line)[0]
				err = runCommand(logChan, "dmsetup", "remove", dev)
				if err != nil {
					logChan <- fmt.Sprintf("Warning: Failed to remove device-mapper entry %s, continuing anyway", dev)
				}
			}
		}
	}

	// 3. Unmount Longhorn mountpoints
	cmd = exec.Command("mount")
	output, err = cmd.Output()
	if err == nil {
		scanner := bufio.NewScanner(bytes.NewReader(output))
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, "longhorn") {
				fields := strings.Fields(line)
				if len(fields) >= 3 {
					mountpoint := fields[2]
					err = runCommand(logChan, "umount", mountpoint)
					if err != nil {
						logChan <- fmt.Sprintf("Warning: Failed to unmount %s, continuing anyway", mountpoint)
					}
				}
			}
		}
	}

	// 4. Remove Longhorn directories and files
	longhornPaths := []string{
		"/var/lib/longhorn",
		"/var/lib/rancher/longhorn",
		"/var/lib/kubelet/plugins/driver.longhorn.io",
		"/var/lib/kubelet/plugins/kubernetes.io/csi/driver.longhorn.io",
		"/dev/longhorn",
	}

	for _, path := range longhornPaths {
		err = os.RemoveAll(path)
		if err != nil {
			logChan <- fmt.Sprintf("Warning: Failed to remove %s, continuing anyway", path)
		}
	}

	logChan <- "Longhorn cleanup completed, proceeding with K3s uninstall..."

	// Now proceed with K3s uninstall
	logChan <- fmt.Sprintf("Executing K3s uninstall script: %s", uninstallScriptPath)

	cmd = exec.Command(uninstallScriptPath)
	var stdOut, stdErr bytes.Buffer
	cmd.Stdout = &stdOut
	cmd.Stderr = &stdErr

	err = cmd.Run()

	// Log output even if there's an error
	if stdOut.Len() > 0 {
		logChan <- "Uninstall script stdout:"
		logChan <- stdOut.String()
	}
	if stdErr.Len() > 0 {
		logChan <- "Uninstall script stderr:"
		logChan <- stdErr.String()
	}

	if err != nil {
		logChan <- fmt.Sprintf("Error running K3s uninstall script: %v", err)
		return errdefs.NewCustomError(errdefs.ErrTypeK3sUninstallFailed, fmt.Sprintf("failed to run K3s uninstall script %s: %v\nStderr: %s", uninstallScriptPath, err, stdErr.String()))
	}

	logChan <- "K3s uninstall script executed successfully."

	// --- Clean up IPTables ---
	logChan <- "Attempting to flush iptables rules and delete chains..."
	iptablesCleanupSuccess := true // Track if cleanup succeeds

	// Commands to run
	iptablesCommands := [][]string{
		{"iptables", "-F"},                 // Flush all rules in filter table
		{"iptables", "-t", "nat", "-F"},    // Flush all rules in nat table
		{"iptables", "-t", "mangle", "-F"}, // Flush all rules in mangle table
		{"iptables", "-X"},                 // Delete all non-default chains
	}

	for _, cmdArgs := range iptablesCommands {
		err := runCommand(logChan, cmdArgs[0], cmdArgs[1:]...)
		if err != nil {
			// Log the error but continue trying other cleanup commands
			logChan <- fmt.Sprintf("Warning: Failed iptables cleanup command '%s': %v", strings.Join(cmdArgs, " "), err)
			iptablesCleanupSuccess = false // Mark cleanup as potentially incomplete
		}
	}

	if iptablesCleanupSuccess {
		logChan <- "iptables cleanup commands executed."
	} else {
		logChan <- "Warning: One or more iptables cleanup commands failed. Manual inspection might be needed."
	}

	logChan <- "K3s uninstall process finished."
	return nil
}
