# unbind-installer

A TUI installer that provisions a single-node K3s cluster and deploys the Unbind
stack (via the helmfile in `deploy/charts`).

## What it does

1. Detects the OS and verifies it is supported (see `internal/osinfo`).
2. Installs prerequisite packages and, on low-memory hosts, sizes and creates a
   swap file automatically.
3. Installs K3s, Helm, Helmfile, and Longhorn.
4. Validates DNS for your domain and configures the container registry.
5. Runs the helmfile sync to bring up Unbind.

The installer prompts only for what it cannot infer: the domain, the registry
choice (and credentials for an external registry), and whether to uninstall an
existing K3s or create a swap file. Nothing is selected automatically.

To look at a single screen without installing anything (no root needed):

```sh
go run ./cmd -screen dns-config -domain unbind.example.com
```

See `go run ./cmd -h` for the list of screens.

## Build & run

```sh
go build -o unbind-installer ./cmd
sudo ./unbind-installer
```

Must be run as root on a supported Linux distribution (amd64 or arm64).

## Post-uninstall cleanup

After `unbind uninstall` (or running `k3s-uninstall.sh`), flush leftover iptables
rules:

```sh
sudo iptables -F
sudo iptables -t nat -F
sudo iptables -t mangle -F
sudo iptables -X
```
