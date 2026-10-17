package team_service

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

const figmaSVG = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="32" cy="32" r="32" fill="url(#paint0_linear)"/>
<defs>
<linearGradient id="paint0_linear" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
<stop stop-color="#7C3AED"/><stop offset="1" stop-color="#DB2777"/>
</linearGradient>
</defs>
</svg>`

func svg(body string) []byte {
	return []byte(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">` + body + `</svg>`)
}

func rasterIcon(t *testing.T, contentType string, size int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if contentType == iconTypeJPEG {
		require.NoError(t, jpeg.Encode(&buf, img, nil))
	} else {
		require.NoError(t, png.Encode(&buf, img))
	}
	return buf.Bytes()
}

// pngWithText inserts a tEXt chunk after IHDR, the way editors store metadata.
func pngWithText(t *testing.T) []byte {
	t.Helper()
	data := rasterIcon(t, iconTypePNG, 8)
	ihdrEnd := len(pngSignature) + 8 + 13 + 4
	body := append([]byte("tEXt"), []byte("Author\x00Alice")...)
	chunk := binary.BigEndian.AppendUint32(nil, uint32(len(body)-4))
	chunk = append(chunk, body...)
	chunk = binary.BigEndian.AppendUint32(chunk, crc32.ChecksumIEEE(body))
	out := append([]byte{}, data[:ihdrEnd]...)
	out = append(out, chunk...)
	return append(out, data[ihdrEnd:]...)
}

func TestParseIconAccepts(t *testing.T) {
	cases := []struct {
		name        string
		data        []byte
		contentType string
	}{
		{"figma svg with gradient", []byte(figmaSVG), iconTypeSVG},
		{"svg with xml declaration and bom", append([]byte("\xEF\xBB\xBF<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"), svg(`<rect width="10" height="10"/>`)...), iconTypeSVG},
		{"svg with internal use", svg(`<defs><path id="p" d="M0 0h10v10z"/></defs><use xlink:href="#p"/>`), iconTypeSVG},
		{"svg with embedded png", svg(`<image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/>`), iconTypeSVG},
		{"svg with style element", svg(`<style>.a{fill:url(#g)}</style><rect class="a" width="10" height="10"/>`), iconTypeSVG},
		{"png", rasterIcon(t, iconTypePNG, 64), iconTypePNG},
		{"jpeg", rasterIcon(t, iconTypeJPEG, 64), iconTypeJPEG},
		{"png at the size limit", rasterIcon(t, iconTypePNG, IconMaxDimension), iconTypePNG},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			icon, err := parseIcon(tc.data)
			require.NoError(t, err)
			assert.Equal(t, tc.contentType, icon.contentType)
			assert.NotEmpty(t, icon.data)
		})
	}
}

func TestParseIconKeepsSVGAsUploaded(t *testing.T) {
	icon, err := parseIcon([]byte(figmaSVG))
	require.NoError(t, err)
	assert.Equal(t, []byte(figmaSVG), icon.data)
}

func TestParseIconDropsPNGMetadata(t *testing.T) {
	data := pngWithText(t)
	require.Contains(t, string(data), "Alice")

	icon, err := parseIcon(data)
	require.NoError(t, err)
	assert.NotContains(t, string(icon.data), "Alice")
	_, err = png.Decode(bytes.NewReader(icon.data))
	assert.NoError(t, err)
}

func TestParseIconRejects(t *testing.T) {
	tooBigPNG := rasterIcon(t, iconTypePNG, IconMaxDimension+1)
	require.LessOrEqual(t, len(tooBigPNG), IconMaxBytes)

	cases := []struct {
		name    string
		data    []byte
		message string
	}{
		{"empty", nil, "Icon is empty"},
		{"over 50 KB", svg(`<desc>` + strings.Repeat("a", IconMaxBytes) + `</desc>`), "Icon is larger than 50 KB"},
		{"gif", []byte("GIF89a\x01\x00\x01\x00"), "Icon is not an SVG, PNG or JPEG"},
		{"plain text", []byte("hello"), "Icon is not an SVG, PNG or JPEG"},
		{"html", []byte(`<html><body>hi</body></html>`), "Icon is not an SVG, PNG or JPEG"},
		{"svg without namespace", []byte(`<svg viewBox="0 0 10 10"></svg>`), "Icon is not an SVG, PNG or JPEG"},
		{"svg without viewBox", []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`), "SVG needs a viewBox"},
		{"broken xml", []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect></svg>`), "SVG is not valid XML"},
		{"two roots", append(svg(""), svg("")...), "SVG has more than one root element"},
		{"doctype", append([]byte(`<!DOCTYPE svg [<!ENTITY x "y">]>`), svg("")...), "SVG has a DOCTYPE or entities"},
		{"stylesheet instruction", append([]byte(`<?xml-stylesheet href="https://evil.test/a.css"?>`), svg("")...), "SVG has processing instructions"},
		{"script", svg(`<script>alert(1)</script>`), "SVG has scripts or embedded content"},
		{"uppercase script", svg(`<SCRIPT>alert(1)</SCRIPT>`), "SVG has scripts or embedded content"},
		{"foreignObject", svg(`<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>`), "SVG has scripts or embedded content"},
		{"event handler", svg(`<rect onload="alert(1)"/>`), "SVG has scripts or embedded content"},
		{"javascript link", svg(`<a href="javascript:alert(1)"><rect/></a>`), "SVG has external links"},
		{"animated link", svg(`<a><set attributeName="href" to="javascript:alert(1)"/></a>`), "SVG has scripts or embedded content"},
		{"external image", svg(`<image href="https://evil.test/a.png"/>`), "SVG has external links"},
		{"external xlink", svg(`<use xlink:href="https://evil.test/a.svg#x"/>`), "SVG has external links"},
		{"nested svg as data", svg(`<image href="data:image/svg+xml;base64,PHN2Zz4="/>`), "SVG has external links"},
		{"external url in attribute", svg(`<rect fill="url(https://evil.test/a)"/>`), "SVG has external links"},
		{"external url in style attribute", svg(`<rect style="fill: url( 'https://evil.test/a' )"/>`), "SVG has external links"},
		{"css import", svg(`<style>@import "https://evil.test/a.css";</style>`), "SVG has external links"},
		{"external url in style element", svg(`<style>rect{background:url(https://evil.test/a)}</style>`), "SVG has external links"},
		{"escaped css", svg(`<style>rect{background:u\72l(https://evil.test/a)}</style>`), "SVG has escaped CSS"},
		{"latin1 svg", []byte("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\"><desc>\xe9</desc></svg>"), "SVG must be UTF-8"},
		{"png over 1024x1024", tooBigPNG, "Icon is larger than 1024×1024"},
		{"truncated png", rasterIcon(t, iconTypePNG, 64)[:40], "Icon could not be read as an image"},
		{"truncated jpeg", rasterIcon(t, iconTypeJPEG, 64)[:40], "Icon could not be read as an image"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := parseIcon(tc.data)
			require.Error(t, err)
			assert.ErrorIs(t, err, errdefs.ErrInvalidInput)
			assert.Equal(t, tc.message, errdefs.DetailMessage(err))
		})
	}
}
