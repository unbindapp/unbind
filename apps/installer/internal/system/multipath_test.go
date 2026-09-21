package system

import (
	"testing"

	"github.com/stretchr/testify/require"
)

const longhornBlock = "    device {\n        vendor \"IET\"\n        product \"VIRTUAL-DISK\"\n    }\n"
const longhornSection = "blacklist {\n" + longhornBlock + "}\n"

func TestEnsureMultipathBlacklist(t *testing.T) {
	tests := []struct {
		name     string
		conf     string
		want     string
		changed  bool
		sections int
	}{
		{
			name:     "empty file gets a new section",
			conf:     "",
			want:     longhornSection,
			changed:  true,
			sections: 1,
		},
		{
			name:     "file without blacklist gets a section appended",
			conf:     "defaults {\n    user_friendly_names yes\n}",
			want:     "defaults {\n    user_friendly_names yes\n}\n\n" + longhornSection,
			changed:  true,
			sections: 1,
		},
		{
			name:     "existing blacklist section receives the device block",
			conf:     "defaults {\n}\n\nblacklist {\n    wwid 3600\n}\n",
			want:     "defaults {\n}\n\nblacklist {\n" + longhornBlock + "    wwid 3600\n}\n",
			changed:  true,
			sections: 1,
		},
		{
			name:     "trailing comment on the section line stays on its line",
			conf:     "blacklist { # local disks\n    wwid 3600\n}\n",
			want:     "blacklist { # local disks\n" + longhornBlock + "    wwid 3600\n}\n",
			changed:  true,
			sections: 1,
		},
		{
			name:     "blacklist_exceptions is not mistaken for blacklist",
			conf:     "blacklist_exceptions {\n    wwid 3600\n}\n",
			want:     "blacklist_exceptions {\n    wwid 3600\n}\n\n" + longhornSection,
			changed:  true,
			sections: 1,
		},
		{
			name:     "one line section is left alone and a new one appended",
			conf:     "blacklist { wwid 3600 }\n",
			want:     "blacklist { wwid 3600 }\n\n" + longhornSection,
			changed:  true,
			sections: 2,
		},
		{
			name:    "already blacklisted is untouched",
			conf:    "blacklist {\n    device {\n        vendor \"IET\"\n        product \"VIRTUAL-DISK\"\n    }\n}\n",
			want:    "blacklist {\n    device {\n        vendor \"IET\"\n        product \"VIRTUAL-DISK\"\n    }\n}\n",
			changed: false,
		},
		{
			name:    "tab separated existing entry is recognised",
			conf:    "blacklist {\n\tdevice {\n\t\tvendor\t\"IET\"\n\t\tproduct\t\"VIRTUAL-DISK\"\n\t}\n}\n",
			want:    "blacklist {\n\tdevice {\n\t\tvendor\t\"IET\"\n\t\tproduct\t\"VIRTUAL-DISK\"\n\t}\n}\n",
			changed: false,
		},
		{
			name:     "vendor alone does not count as blacklisted",
			conf:     "blacklist {\n    device {\n        vendor \"IET\"\n        product \"OTHER\"\n    }\n}\n",
			want:     "blacklist {\n" + longhornBlock + "    device {\n        vendor \"IET\"\n        product \"OTHER\"\n    }\n}\n",
			changed:  true,
			sections: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := EnsureMultipathBlacklist(tt.conf)
			require.Equal(t, tt.changed, changed)
			require.Equal(t, tt.want, got)
			if !changed {
				return
			}
			require.Len(t, blacklistSectionLine.FindAllStringIndex(got, -1), tt.sections)
			again, changedAgain := EnsureMultipathBlacklist(got)
			require.False(t, changedAgain)
			require.Equal(t, got, again)
		})
	}
}
