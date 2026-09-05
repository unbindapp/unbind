package service_repo

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func TestMergePorts(t *testing.T) {
	existing := []schema.PortSpec{{Port: 3000}, {Port: 4000}}

	assert.Equal(t, existing, MergePorts(existing, nil, nil, nil))
	assert.Equal(t, []schema.PortSpec{{Port: 9000}}, MergePorts(existing, []schema.PortSpec{{Port: 9000}}, []schema.PortSpec{{Port: 5000}}, nil))
	assert.Equal(t, []schema.PortSpec{{Port: 3000}, {Port: 4000}, {Port: 5000}}, MergePorts(existing, nil, []schema.PortSpec{{Port: 5000}}, nil))
	assert.Equal(t, []schema.PortSpec{{Port: 4000}, {Port: 3000, IsNodePort: true}}, MergePorts(existing, nil, []schema.PortSpec{{Port: 3000, IsNodePort: true}}, nil))
	assert.Equal(t, []schema.PortSpec{{Port: 4000}}, MergePorts(existing, nil, nil, []schema.PortSpec{{Port: 3000}}))
	assert.Empty(t, MergePorts(existing, nil, nil, existing))
}

func TestMergeHosts(t *testing.T) {
	existing := []schema.HostSpec{
		{Host: "a.com", TemplateInputID: utils.ToPtr("domain"), DisplayName: utils.ToPtr("Domain")},
		{Host: "b.com"},
	}

	assert.Equal(t, existing, MergeHosts(existing, nil, nil, nil))
	assert.Equal(t, []schema.HostSpec{{Host: "z.com"}}, MergeHosts(existing, []schema.HostSpec{{Host: "z.com"}}, []schema.HostSpec{{Host: "c.com"}}, nil))
	assert.Equal(t, append(existing, schema.HostSpec{Host: "c.com"}), MergeHosts(existing, nil, []schema.HostSpec{{Host: "c.com"}}, nil))
	assert.Equal(t,
		[]schema.HostSpec{{Host: "b.com"}, {Host: "a.com", Path: "/api", TemplateInputID: utils.ToPtr("domain"), DisplayName: utils.ToPtr("Domain")}},
		MergeHosts(existing, nil, []schema.HostSpec{{Host: "a.com", Path: "/api"}}, nil),
	)
	assert.Equal(t,
		[]schema.HostSpec{{Host: "b.com"}, {Host: "new.com", PrevHost: utils.ToPtr("a.com"), TemplateInputID: utils.ToPtr("domain"), DisplayName: utils.ToPtr("Domain")}},
		MergeHosts(existing, nil, []schema.HostSpec{{Host: "new.com", PrevHost: utils.ToPtr("a.com")}}, nil),
	)
	assert.Equal(t, []schema.HostSpec{{Host: "b.com"}}, MergeHosts(existing, nil, nil, []schema.HostSpec{{Host: "a.com"}}))
	assert.Empty(t, MergeHosts(existing, nil, nil, existing))
}
