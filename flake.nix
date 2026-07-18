{
  description = "Unbind development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    # The installer and charts target helm 3; nixpkgs-unstable only carries helm 4,
    # whose CRD handling breaks the postgres-operator presync hook.
    nixpkgs-helm3.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs =
    { nixpkgs, nixpkgs-helm3, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              go
              gopls
              nodejs_24
              kubectl
              kustomize
              nixpkgs-helm3.legacyPackages.${system}.kubernetes-helm
              helmfile
              k3d
            ];

            shellHook = ''
              root="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
              dev_kubeconfig="$root/apps/api/.data/kubernetes/k3d.kubeconfig.yaml"
              if [ -z "''${KUBECONFIG:-}" ] && [ -f "$dev_kubeconfig" ]; then
                export KUBECONFIG="$dev_kubeconfig"
              fi
            '';
          };
        }
      );
    };
}
