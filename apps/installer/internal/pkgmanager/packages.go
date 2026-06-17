package pkgmanager

import "sort"

// PackageMapping defines the mapping of common package names to distribution-specific package names
var PackageMapping = map[string]map[string]string{
	"tar": {
		"ubuntu":    "tar",
		"debian":    "tar",
		"fedora":    "tar",
		"centos":    "tar",
		"opensuse":  "tar",
		"rocky":     "tar",
		"almalinux": "tar",
	},
	"iscsiadm": {
		"ubuntu":    "open-iscsi",
		"debian":    "open-iscsi",
		"fedora":    "iscsi-initiator-utils",
		"centos":    "iscsi-initiator-utils",
		"opensuse":  "open-iscsi",
		"rocky":     "iscsi-initiator-utils",
		"almalinux": "iscsi-initiator-utils",
	},
	"git": {
		"ubuntu":    "git",
		"debian":    "git",
		"fedora":    "git",
		"centos":    "git",
		"opensuse":  "git",
		"rocky":     "git",
		"almalinux": "git",
	},
	"curl": {
		"ubuntu":    "curl",
		"debian":    "curl",
		"fedora":    "curl",
		"centos":    "curl",
		"opensuse":  "curl",
		"rocky":     "curl",
		"almalinux": "curl",
	},
	"wget": {
		"ubuntu":    "wget",
		"debian":    "wget",
		"fedora":    "wget",
		"centos":    "wget",
		"opensuse":  "wget",
		"rocky":     "wget",
		"almalinux": "wget",
	},
	"ca-certificates": {
		"ubuntu":    "ca-certificates",
		"debian":    "ca-certificates",
		"fedora":    "ca-certificates",
		"centos":    "ca-certificates",
		"opensuse":  "ca-certificates",
		"rocky":     "ca-certificates",
		"almalinux": "ca-certificates",
	},
	"apt-transport-https": {
		"ubuntu":    "apt-transport-https",
		"debian":    "apt-transport-https",
		"fedora":    "", // Not needed on Fedora
		"centos":    "", // Not needed on CentOS
		"opensuse":  "", // Not needed on OpenSUSE
		"rocky":     "", // Not needed on Rocky
		"almalinux": "", // Not needed on AlmaLinux
	},
	"apache2-utils": {
		"ubuntu":    "apache2-utils",
		"debian":    "apache2-utils",
		"fedora":    "httpd-tools",
		"centos":    "httpd-tools",
		"opensuse":  "apache2-utils",
		"rocky":     "httpd-tools",
		"almalinux": "httpd-tools",
	},
}

// GetDistributionPackages returns all available packages for the specified distribution
func GetDistributionPackages(distribution string) []string {
	var result []string
	for _, packageMap := range PackageMapping {
		if distPkg, ok := packageMap[distribution]; ok && distPkg != "" {
			result = append(result, distPkg)
		}
	}

	sort.Strings(result)
	return result
}
