package team_service

import (
	"bytes"
	"encoding/xml"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

const (
	IconMaxBytes     = 50 * 1024
	IconMaxDimension = 1024

	iconTypeSVG  = "image/svg+xml"
	iconTypePNG  = "image/png"
	iconTypeJPEG = "image/jpeg"

	svgNamespace = "http://www.w3.org/2000/svg"
)

var (
	pngSignature  = []byte("\x89PNG\r\n\x1a\n")
	jpegSignature = []byte{0xFF, 0xD8, 0xFF}
	utf8BOM       = []byte("\xEF\xBB\xBF")

	blockedSVGElements = map[string]bool{
		"script": true, "foreignobject": true, "iframe": true, "object": true, "embed": true,
		"handler": true, "listener": true, "audio": true, "video": true,
	}
	embeddedImageHref = regexp.MustCompile(`^data:image/(png|jpeg|gif|webp);`)
	cssURL            = regexp.MustCompile(`url\(\s*['"]?\s*([^'"\s)]*)`)
)

type iconFile struct {
	contentType string
	data        []byte
}

func invalidIcon(message string) error {
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, message)
}

// parseIcon checks an uploaded icon and returns what should be stored. PNG and JPEG
// are re-encoded, which proves they decode and drops metadata such as EXIF.
func parseIcon(data []byte) (*iconFile, error) {
	if len(data) == 0 {
		return nil, invalidIcon("Icon is empty")
	}
	if len(data) > IconMaxBytes {
		return nil, invalidIcon("Icon is larger than 50 KB")
	}

	switch {
	case bytes.HasPrefix(data, pngSignature):
		return parseRasterIcon(data, iconTypePNG)
	case bytes.HasPrefix(data, jpegSignature):
		return parseRasterIcon(data, iconTypeJPEG)
	case looksLikeXML(data):
		if err := checkSVG(data); err != nil {
			return nil, err
		}
		return &iconFile{contentType: iconTypeSVG, data: data}, nil
	}
	return nil, invalidIcon("Icon is not an SVG, PNG or JPEG")
}

func parseRasterIcon(data []byte, contentType string) (*iconFile, error) {
	decodeConfig, decode := png.DecodeConfig, png.Decode
	if contentType == iconTypeJPEG {
		decodeConfig, decode = jpeg.DecodeConfig, jpeg.Decode
	}

	config, err := decodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, invalidIcon("Icon could not be read as an image")
	}
	if config.Width <= 0 || config.Height <= 0 {
		return nil, invalidIcon("Icon could not be read as an image")
	}
	if config.Width > IconMaxDimension || config.Height > IconMaxDimension {
		return nil, invalidIcon("Icon is larger than 1024×1024")
	}

	img, err := decode(bytes.NewReader(data))
	if err != nil {
		return nil, invalidIcon("Icon could not be read as an image")
	}

	encoded, err := encodeRaster(img, contentType)
	if err != nil {
		return nil, err
	}
	return &iconFile{contentType: contentType, data: encoded}, nil
}

func encodeRaster(img image.Image, contentType string) ([]byte, error) {
	var buf bytes.Buffer
	if contentType == iconTypeJPEG {
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	}
	encoder := png.Encoder{CompressionLevel: png.BestCompression}
	if err := encoder.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func looksLikeXML(data []byte) bool {
	trimmed := bytes.TrimLeft(bytes.TrimPrefix(data, utf8BOM), " \t\r\n")
	return bytes.HasPrefix(trimmed, []byte("<"))
}

// checkSVG rejects anything that could run code or load from elsewhere. Icons are only
// ever shown through <img> and served sandboxed, so this is a second line of defense.
func checkSVG(data []byte) error {
	if !utf8.Valid(data) {
		return invalidIcon("SVG must be UTF-8")
	}

	decoder := xml.NewDecoder(bytes.NewReader(bytes.TrimPrefix(data, utf8BOM)))
	depth := 0
	sawRoot := false
	inStyle := false

	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return invalidIcon("SVG is not valid XML")
		}

		switch t := token.(type) {
		case xml.ProcInst:
			if t.Target != "xml" {
				return invalidIcon("SVG has processing instructions")
			}
		case xml.Directive:
			return invalidIcon("SVG has a DOCTYPE or entities")
		case xml.StartElement:
			if depth == 0 {
				if sawRoot {
					return invalidIcon("SVG has more than one root element")
				}
				if t.Name.Local != "svg" || t.Name.Space != svgNamespace {
					return invalidIcon("Icon is not an SVG, PNG or JPEG")
				}
				if !hasAttr(t, "viewBox") {
					return invalidIcon("SVG needs a viewBox")
				}
				sawRoot = true
			}
			if err := checkSVGElement(t); err != nil {
				return err
			}
			inStyle = strings.EqualFold(t.Name.Local, "style")
			depth++
		case xml.EndElement:
			inStyle = false
			depth--
		case xml.CharData:
			if depth == 0 && len(bytes.TrimSpace(t)) > 0 {
				return invalidIcon("SVG is not valid XML")
			}
			if inStyle {
				if err := checkCSS(string(t)); err != nil {
					return err
				}
			}
		}
	}

	if !sawRoot {
		return invalidIcon("Icon is not an SVG, PNG or JPEG")
	}
	return nil
}

func checkSVGElement(element xml.StartElement) error {
	name := strings.ToLower(element.Name.Local)
	if blockedSVGElements[name] {
		return invalidIcon("SVG has scripts or embedded content")
	}

	for _, attr := range element.Attr {
		attrName := strings.ToLower(attr.Name.Local)
		value := strings.TrimSpace(attr.Value)

		switch {
		case strings.HasPrefix(attrName, "on"):
			return invalidIcon("SVG has scripts or embedded content")
		case attrName == "href":
			if !strings.HasPrefix(value, "#") && !embeddedImageHref.MatchString(value) {
				return invalidIcon("SVG has external links")
			}
		case attrName == "attributename":
			if strings.Contains(strings.ToLower(value), "href") {
				return invalidIcon("SVG has scripts or embedded content")
			}
		}

		if strings.Contains(strings.ToLower(value), "javascript:") {
			return invalidIcon("SVG has scripts or embedded content")
		}
		if err := checkCSS(value); err != nil {
			return err
		}
	}
	return nil
}

// checkCSS allows url() only for references inside the file, like url(#gradient).
// Escapes are refused so url( can't be spelled in a way this check misses.
func checkCSS(css string) error {
	if strings.ContainsRune(css, '\\') {
		return invalidIcon("SVG has escaped CSS")
	}
	lower := strings.ToLower(css)
	if strings.Contains(lower, "@import") || strings.Contains(lower, "image-set(") {
		return invalidIcon("SVG has external links")
	}
	for _, match := range cssURL.FindAllStringSubmatch(lower, -1) {
		if !strings.HasPrefix(match[1], "#") {
			return invalidIcon("SVG has external links")
		}
	}
	return nil
}

func hasAttr(element xml.StartElement, name string) bool {
	for _, attr := range element.Attr {
		if attr.Name.Local == name && attr.Name.Space == "" {
			return true
		}
	}
	return false
}
