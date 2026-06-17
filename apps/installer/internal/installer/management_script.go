package installer

import (
	"fmt"
	"os"
	"path/filepath"
)

const managementScriptContent = `#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Box drawing characters
BOX_TOP="╔════════════════════════════════════════════════════════════╗"
BOX_MID="║"
BOX_BOT="╚════════════════════════════════════════════════════════════╝"

# Function to print the Unbind banner
print_banner() {
    echo -e "${GREEN}"
    echo " _   _       _     _           _"
    echo "| | | |_ __ | |__ (_)_ __   __| |"
    echo "| | | | '_ \| '_ \| | '_ \ / _  |"
    echo "| |_| | | | | |_) | | | | | (_| |"
    echo " \___/|_| |_|_.__/|_|_| |_|\__,_|"
    echo -e "${NC}"
}

# Unbind Management Script
# This script provides management functions for Unbind

# Configuration file location
CONFIG_FILE="/etc/unbind/config"

# Function to print a boxed message
print_box() {
    local message="$1"
    local color="$2"
    echo -e "${color}${BOX_TOP}${NC}"
    echo -e "${color}${BOX_MID}${NC} ${message} ${color}${BOX_MID}${NC}"
    echo -e "${color}${BOX_BOT}${NC}"
}

# Function to check if Unbind is installed
check_installation() {
    if [ ! -f "/usr/local/bin/k3s-uninstall.sh" ]; then
        print_banner
        print_box "Error: No Unbind installation detected." "$RED"
        echo -e "${RED}This script should only be run on a server with Unbind installed.${NC}"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    print_banner
    print_box "Unbind Management Script" "$BLUE"
    echo -e "${BOLD}Usage:${NC} unbind <command>"
    echo ""
    echo -e "${BOLD}Commands:${NC}"
    echo -e "  ${CYAN}uninstall${NC}    - Uninstall Unbind (${RED}WARNING: This will permanently delete all data${NC})"
    echo -e "  ${CYAN}add-node${NC}     - Show instructions for adding a new node"
    # echo ""
    # echo -e "${MAGENTA}For more information, visit https://unbind.app/docs${NC}"
}

# Function to handle uninstallation
handle_uninstall() {
    check_installation

    print_banner
    print_box "WARNING: Unbind Uninstallation" "$RED"
    echo -e "${RED}This will permanently delete all Unbind data and configurations.${NC}"
    echo -e "${RED}This action cannot be undone.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Uninstalling Unbind...${NC}"
        export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
        kubectl -n longhorn-system patch settings.longhorn.io deleting-confirmation-flag -p '{"value":"true"}' --type=merge || true
        kubectl create -f https://raw.githubusercontent.com/longhorn/longhorn/v1.9.0/uninstall/uninstall.yaml || true
        
        # Wait for uninstall job with timeout
        timeout=300
        while [ $timeout -gt 0 ]; do
            if kubectl -n longhorn-system get job longhorn-uninstall -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' | grep -q "True"; then
                echo "Longhorn uninstall job completed successfully"
                break
            fi
            sleep 5
            timeout=$((timeout - 5))
        done
        if [ $timeout -le 0 ]; then
            echo "Warning: Longhorn uninstall job timed out, continuing anyway"
        fi

        /usr/local/bin/k3s-uninstall.sh
        # Remove longhorn
        # 1. Log out of any leftover iSCSI sessions Longhorn created
        iscsiadm -m session | grep 'io.longhorn' | awk '{print $2}' | sed 's/\[\([0-9]*\)\]/\1/' | xargs -r -I{} iscsiadm -m session -u -r {}
        iscsiadm -m node --targetname iqn.*.longhorn* -o delete || true

        # 2. Remove any device-mapper entries that still reference Longhorn
        for dev in $(sudo dmsetup ls 2>/dev/null | grep longhorn | awk '{print $1}'); do
            dmsetup remove "$dev" || true
        done

        # 3. Unmount and delete mountpoints that the k3s uninstall script ignored
        umount $(mount | grep longhorn | awk '{print $3}') 2>/dev/null || true

        # 4. Blow away the on-disk data and plugin sockets
        rm -rf /var/lib/longhorn \
                    /var/lib/rancher/longhorn \
                    /var/lib/kubelet/plugins/driver.longhorn.io \
                    /var/lib/kubelet/plugins/kubernetes.io/csi/driver.longhorn.io \
                    /dev/longhorn 2>/dev/null || true
        print_banner
        print_box "Unbind has been uninstalled successfully." "$GREEN"
    else
        print_banner
        print_box "Uninstallation cancelled." "$BLUE"
    fi
}

# Function to show add node instructions
handle_add_node() {
    check_installation

    # Get the node token
    token=$(cat /var/lib/rancher/k3s/server/node-token 2>/dev/null)
    if [ -z "$token" ]; then
        print_banner
        print_box "Error: Could not find node token." "$RED"
        echo -e "${RED}Is K3S running?${NC}"
        exit 1
    fi

    # Get the current K3s version (keep the full version including +k3s1)
    k3s_version=$(k3s --version 2>/dev/null | head -n1 | awk '{print $3}')
    if [ -z "$k3s_version" ]; then
        print_banner
        print_box "Warning: Could not detect K3s version." "$YELLOW"
        echo -e "${YELLOW}The command below will install the latest version of K3s.${NC}"
        echo -e "${YELLOW}If you need a specific version, add INSTALL_K3S_VERSION=<version> to the command.${NC}"
        echo ""
    fi

    # Get the server URL from config file
    if [ ! -f "$CONFIG_FILE" ]; then
        print_banner
        print_box "Error: Could not find Unbind configuration file." "$RED"
        echo -e "${RED}The cluster IP address is not available.${NC}"
        exit 1
    fi

    # Read the cluster IP from the config file
    cluster_ip=$(grep "^CLUSTER_IP=" "$CONFIG_FILE" | cut -d'=' -f2)
    if [ -z "$cluster_ip" ]; then
        print_banner
        print_box "Error: Could not find cluster IP in configuration." "$RED"
        exit 1
    fi

    server_url="https://${cluster_ip}:6443"

    print_banner
    print_box "Add Node Instructions" "$BLUE"
    echo -e "${BOLD}To add a new node to your Unbind cluster, run the following command on the new server:${NC}"
    echo ""
    
    # Build the command with version if available
    if [ -n "$k3s_version" ]; then
        echo -e "${CYAN}curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=$k3s_version K3S_URL=$server_url K3S_TOKEN=$token sh -${NC}"
        echo ""
        echo -e "${GREEN}This will install K3s version: $k3s_version${NC}"
    else
        echo -e "${CYAN}curl -sfL https://get.k3s.io | K3S_URL=$server_url K3S_TOKEN=$token sh -${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Note:${NC} Make sure the new server can reach this server on port 6443"
}

# Main script logic
case "$1" in
    "uninstall")
        handle_uninstall
        ;;
    "add-node")
        handle_add_node
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
`

// InstallManagementScript installs the management script to the system
func InstallManagementScript(clusterIP string) error {
	// Create config directory if it doesn't exist
	configDir := "/etc/unbind"
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Create config file with cluster IP
	configPath := filepath.Join(configDir, "config")
	configContent := fmt.Sprintf("CLUSTER_IP=%s\n", clusterIP)
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	// Create the script file
	scriptPath := "/usr/local/bin/unbind"
	if err := os.WriteFile(scriptPath, []byte(managementScriptContent), 0755); err != nil {
		return fmt.Errorf("failed to write management script: %w", err)
	}

	return nil
}
