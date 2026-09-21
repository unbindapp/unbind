package installer

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/unbindapp/unbind-installer/internal/k3s"
)

const managementScriptPath = "/usr/local/bin/unbind"

const managementScriptTemplate = `#!/bin/bash

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
CONFIG_FILE="__HOST_CONFIG_PATH__"
KUBELET_CONFIG_PATH="__KUBELET_CONFIG_PATH__"
KUBELET_ARGS="__KUBELET_ARGS__"
SERVER_FLAGS="__SERVER_FLAGS__"

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
    echo -e "  ${CYAN}update-node${NC}  - Apply the current k3s and kubelet settings to this server"
    # echo ""
    # echo -e "${MAGENTA}For more information, visit https://unbind.app/docs${NC}"
}

print_kubelet_config() {
    cat <<'KUBELETEOF'
__KUBELET_CONFIG__
KUBELETEOF
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
        kubectl create -f https://raw.githubusercontent.com/longhorn/longhorn/v1.12.1/uninstall/uninstall.yaml || true

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

    # When the cluster uses the self-hosted registry, the primary has a registries.yaml
    # pointing containerd at it. New nodes need the same file, or their pulls will fail.
    registries_content=""
    if [ -f /etc/rancher/k3s/registries.yaml ]; then
        registries_content=$(cat /etc/rancher/k3s/registries.yaml)
    fi

    print_banner
    print_box "Add Node Instructions" "$BLUE"
    echo -e "${BOLD}To add a new node to your Unbind cluster, run the following on the new server:${NC}"
    echo ""

    step=1
    if [ -n "$registries_content" ]; then
        echo -e "${BOLD}${step}. Point containerd at the Unbind registry:${NC}"
        echo ""
        echo -e "${CYAN}sudo mkdir -p /etc/rancher/k3s && sudo tee /etc/rancher/k3s/registries.yaml > /dev/null <<'REGEOF'"
        echo "$registries_content"
        echo -e "REGEOF${NC}"
        echo ""
        step=$((step + 1))
    fi

    echo -e "${BOLD}${step}. Keep multipathd off Longhorn devices:${NC}"
    echo ""
    echo -e "${CYAN}sudo bash <<'MPEOF'"
    cat <<'MPSCRIPT'
command -v multipathd >/dev/null 2>&1 || exit 0
if [ -n "$(multipath -ll 2>/dev/null)" ]; then
    echo "this host uses multipath, leaving /etc/multipath.conf alone: https://longhorn.io/kb/troubleshooting-volume-with-multipath/"
    exit 0
fi
touch /etc/multipath.conf
if grep -qE 'vendor[[:space:]]+"IET"' /etc/multipath.conf && grep -qE 'product[[:space:]]+"VIRTUAL-DISK"' /etc/multipath.conf; then
    exit 0
fi
if grep -qE '^[[:space:]]*blacklist[[:space:]]*\{' /etc/multipath.conf; then
    sed -i -E '0,/^[[:space:]]*blacklist[[:space:]]*\{/s//&\n    device {\n        vendor "IET"\n        product "VIRTUAL-DISK"\n    }/' /etc/multipath.conf
else
    printf '\nblacklist {\n    device {\n        vendor "IET"\n        product "VIRTUAL-DISK"\n    }\n}\n' >> /etc/multipath.conf
fi
if systemctl is-active --quiet multipathd; then
    systemctl restart multipathd
fi
MPSCRIPT
    echo -e "MPEOF${NC}"
    echo ""
    step=$((step + 1))

    echo -e "${BOLD}${step}. Configure the kubelet:${NC}"
    echo ""
    echo -e "${CYAN}sudo mkdir -p $(dirname "$KUBELET_CONFIG_PATH") && sudo tee $KUBELET_CONFIG_PATH > /dev/null <<'KUBELETEOF'"
    print_kubelet_config
    echo -e "KUBELETEOF${NC}"
    echo ""
    step=$((step + 1))

    echo -e "${BOLD}${step}. Join the cluster:${NC}"
    echo ""
    if [ -n "$k3s_version" ]; then
        echo -e "${CYAN}curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=$k3s_version K3S_URL=$server_url K3S_TOKEN=$token INSTALL_K3S_EXEC=\"$KUBELET_ARGS\" sh -${NC}"
        echo ""
        echo -e "${GREEN}This will install K3s version: $k3s_version${NC}"
    else
        echo -e "${CYAN}curl -sfL https://get.k3s.io | K3S_URL=$server_url K3S_TOKEN=$token INSTALL_K3S_EXEC=\"$KUBELET_ARGS\" sh -${NC}"
    fi

    echo ""
    echo -e "${YELLOW}Note:${NC} Make sure the new server can reach this server on port 6443"
    echo -e "${YELLOW}Note:${NC} Rerun steps $((step - 1)) and ${step} on a node that already joined to bring its kubelet settings up to date"
}

# The kubelet config adds hard eviction at 15% free image space and 10% free node space,
# so a nearly full disk must be pruned before the restart or pods get evicted immediately.
prune_images_if_full() {
    local image_dir=/var/lib/rancher/k3s/agent/containerd
    [ -d "$image_dir" ] || image_dir=/var/lib/rancher
    local used
    used=$(df --output=pcent "$image_dir" 2>/dev/null | tail -n1 | tr -dc '0-9')
    if [ -z "$used" ] || [ "$used" -lt 80 ]; then
        return 0
    fi
    echo -e "${YELLOW}Disk holding container images is ${used}% full, pruning unused images first...${NC}"
    k3s crictl rmi --prune || true
}

# Rerunning the k3s installer with the current flags regenerates the systemd unit and
# restarts k3s. Flags baked into an older unit override the config file, so the file
# alone is not enough. Workloads keep running through the restart.
handle_update_node() {
    check_installation

    if [ ! -f "$CONFIG_FILE" ]; then
        print_banner
        print_box "Error: This host was not set up as an Unbind server." "$RED"
        echo -e "${RED}Run 'unbind add-node' on the server and repeat the printed steps on this node instead.${NC}"
        exit 1
    fi

    print_banner
    print_box "Updating this server's k3s configuration" "$BLUE"

    mkdir -p "$(dirname "$KUBELET_CONFIG_PATH")"
    print_kubelet_config > "$KUBELET_CONFIG_PATH"
    echo -e "${GREEN}Wrote ${KUBELET_CONFIG_PATH}${NC}"

    prune_images_if_full

    echo -e "${YELLOW}Regenerating the k3s service and restarting it...${NC}"
    if ! curl -sfL https://get.k3s.io | INSTALL_K3S_SKIP_DOWNLOAD=true INSTALL_K3S_EXEC="$SERVER_FLAGS" sh -; then
        print_box "Error: k3s installer failed, see the output above." "$RED"
        exit 1
    fi

    print_box "This server now runs the current k3s configuration." "$GREEN"
    echo -e "Verify with: ${CYAN}kubectl get --raw \"/api/v1/nodes/$(hostname | tr 'A-Z' 'a-z')/proxy/configz\"${NC}"
    echo -e "Other nodes: run ${CYAN}unbind add-node${NC} and repeat the kubelet and join steps on each of them."
}

# Main script logic
case "$1" in
    "uninstall")
        handle_uninstall
        ;;
    "add-node")
        handle_add_node
        ;;
    "update-node")
        handle_update_node
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
`

func renderManagementScript() string {
	return strings.NewReplacer(
		"__HOST_CONFIG_PATH__", k3s.UnbindHostConfigPath,
		"__KUBELET_CONFIG_PATH__", k3s.KubeletConfigPath,
		"__KUBELET_CONFIG__", strings.TrimRight(k3s.KubeletConfig, "\n"),
		"__KUBELET_ARGS__", k3s.KubeletArgs,
		"__SERVER_FLAGS__", k3s.ServerInstallFlags,
	).Replace(managementScriptTemplate)
}

// WriteManagementScript installs or refreshes the management script on the host
func WriteManagementScript() error {
	if err := os.WriteFile(managementScriptPath, []byte(renderManagementScript()), 0755); err != nil {
		return fmt.Errorf("failed to write management script: %w", err)
	}
	return nil
}

// InstallManagementScript installs the management script and the host config to the system
func InstallManagementScript(clusterIP string) error {
	if err := os.MkdirAll(filepath.Dir(k3s.UnbindHostConfigPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	configContent := fmt.Sprintf("CLUSTER_IP=%s\n", clusterIP)
	if err := os.WriteFile(k3s.UnbindHostConfigPath, []byte(configContent), 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return WriteManagementScript()
}

// UpdateNode refreshes the management script and applies the current k3s configuration to this server
func UpdateNode(logChan chan<- string) error {
	if err := WriteManagementScript(); err != nil {
		return err
	}
	return k3s.RunCommand(logChan, managementScriptPath, "update-node")
}
