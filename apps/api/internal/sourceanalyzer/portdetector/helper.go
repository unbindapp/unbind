package portdetector

import (
	"regexp"
	"strconv"
)

func matchPort(txt string, re *regexp.Regexp, dst **int) bool {
	if m := re.FindStringSubmatch(txt); len(m) >= 2 {
		for _, grp := range m[1:] {
			if grp == "" {
				continue
			}
			if p, err := strconv.Atoi(grp); err == nil && p != 0 {
				*dst = &p
				return true
			}
		}
	}
	return false
}
