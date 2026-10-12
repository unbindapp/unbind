package mail

import (
	"bytes"
	"embed"
	htmltemplate "html/template"
	texttemplate "text/template"
)

//go:embed templates/*
var templateFS embed.FS

const logoName = "logo.png"

var (
	htmlTemplate = htmltemplate.Must(htmltemplate.ParseFS(templateFS, "templates/layout.html"))
	textTemplate = texttemplate.Must(texttemplate.ParseFS(templateFS, "templates/layout.txt"))
	logoPNG      = mustRead("templates/" + logoName)
)

func mustRead(name string) []byte {
	data, err := templateFS.ReadFile(name)
	if err != nil {
		panic(err)
	}
	return data
}

// Content is one transactional email: a heading, some paragraphs and at most one
// call to action. Every mail Unbind sends is rendered from it, as text and HTML.
type Content struct {
	Subject     string
	Heading     string
	Paragraphs  []string
	ButtonLabel string
	ButtonURL   string
	Note        string
	InstanceURL string
}

func Render(to string, content Content) (Message, error) {
	var text, html bytes.Buffer
	if err := textTemplate.Execute(&text, content); err != nil {
		return Message{}, err
	}
	if err := htmlTemplate.Execute(&html, content); err != nil {
		return Message{}, err
	}
	return Message{
		To:      to,
		Subject: content.Subject,
		Text:    text.String(),
		HTML:    html.String(),
		Inline:  []Inline{{Name: logoName, ContentType: "image/png", Data: logoPNG}},
	}, nil
}
