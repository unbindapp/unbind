package enum

import (
	"reflect"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/railwayapp/railpack/core/generate"
)

func DetectFramework(provider Provider, ctx *generate.GenerateContext) Framework {
	switch provider {
	case Node:
		framework, ok := ctx.Metadata.Properties["nodeRuntime"]
		if !ok {
			return UnknownFramework
		}
		switch framework {
		case "next":
			return Next
		case "nuxt":
			return Nuxt
		case "astro":
			return Astro
		case "vite":
			return Vite
		case "cra":
			return CRA
		case "angular":
			return Angular
		case "remix":
			return Remix
		case "tanstack-start":
			return TanstackStart
		case "react-router":
			return ReactRouter
		case "bun":
			return BunFW
		case "static":
			return StaticFW
		}
	case Python:
		framework, ok := ctx.Metadata.Properties["pythonRuntime"]
		if !ok {
			return UnknownFramework
		}
		switch framework {
		case "django":
			return Django
		case "flask":
			return Flask
		case "fastapi":
			return FastAPI
		case "fasthtml":
			return FastHTML
		}
	case Go:
		if ctx.Metadata.Properties["goGin"] == "true" {
			return Gin
		}
	case Java:
		if ctx.Metadata.Properties["javaFramework"] == "spring-boot" {
			return SpringBoot
		}
	case PHP:
		if ctx.Metadata.Properties["phpLaravel"] == "true" {
			return Laravel
		}
	case Ruby:
		if ctx.Metadata.Properties["rubyRails"] == "true" {
			return Rails
		}
	case Rust:
		if ctx.Deploy == nil {
			return UnknownFramework
		}
		for _, variable := range ctx.Deploy.Variables {
			if strings.EqualFold(variable, "rocket_address") {
				return Rocket
			}
		}
	}

	return UnknownFramework
}

// Framework represents the detected framework
type Framework string

const (
	Next             Framework = "next"
	Nuxt             Framework = "nuxt"
	Astro            Framework = "astro"
	Vite             Framework = "vite"
	CRA              Framework = "cra"
	Angular          Framework = "angular"
	Remix            Framework = "remix"
	TanstackStart    Framework = "tanstack-start"
	ReactRouter      Framework = "react-router"
	BunFW            Framework = "bun"
	StaticFW         Framework = "static"
	Sveltekit        Framework = "sveltekit"
	Svelte           Framework = "svelte"
	Solid            Framework = "solid"
	Hono             Framework = "hono"
	Express          Framework = "express"
	Django           Framework = "django"
	Flask            Framework = "flask"
	FastAPI          Framework = "fastapi"
	FastHTML         Framework = "fasthtml"
	Gin              Framework = "gin"
	SpringBoot       Framework = "spring-boot"
	Laravel          Framework = "laravel"
	Rails            Framework = "rails"
	Rocket           Framework = "rocket"
	UnknownFramework Framework = "unknown"
)

var allFrameworks = []Framework{
	Next, Nuxt, Astro, Vite, CRA, Angular, Remix, TanstackStart, ReactRouter, BunFW, StaticFW,
	Sveltekit, Svelte, Solid, Hono, Express,
	Django, Flask, FastAPI, FastHTML,
	Gin,
	SpringBoot,
	Laravel,
	Rails,
	Rocket,
	UnknownFramework,
}

// Values provides list valid values for Enum.
func (Framework) Values() (kinds []string) {
	for _, s := range allFrameworks {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u Framework) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["Framework"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "Framework")
		schemaRef.Title = "Framework"
		for _, v := range allFrameworks {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["Framework"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/Framework"}
}
