{{- define "registry.toBytes" -}}
{{- $value := . | toString -}}
{{- $number := regexFind "^[0-9.]+" $value | float64 -}}
{{- $unit := regexFind "[A-Za-z]+$" $value -}}
{{- $multiplier := 1.0 -}}
{{- if eq $unit "Ki" -}}{{- $multiplier = 1024.0 -}}
{{- else if eq $unit "Mi" -}}{{- $multiplier = 1048576.0 -}}
{{- else if eq $unit "Gi" -}}{{- $multiplier = 1073741824.0 -}}
{{- else if eq $unit "Ti" -}}{{- $multiplier = 1099511627776.0 -}}
{{- else if eq $unit "K" -}}{{- $multiplier = 1000.0 -}}
{{- else if eq $unit "M" -}}{{- $multiplier = 1000000.0 -}}
{{- else if eq $unit "G" -}}{{- $multiplier = 1000000000.0 -}}
{{- else if eq $unit "T" -}}{{- $multiplier = 1000000000000.0 -}}
{{- end -}}
{{- printf "%.0f" (mulf $number $multiplier) -}}
{{- end -}}

{{/* Never request less than the existing claim: kubernetes rejects shrinking a PVC */}}
{{- define "registry.storageSize" -}}
{{- $size := .Values.persistence.size | default "5Gi" -}}
{{- $existing := lookup "v1" "PersistentVolumeClaim" .Release.Namespace "registry-pvc" -}}
{{- if $existing -}}
{{- $current := dig "spec" "resources" "requests" "storage" "" $existing -}}
{{- if $current -}}
{{- if gt (include "registry.toBytes" $current | float64) (include "registry.toBytes" $size | float64) -}}
{{- $size = $current -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- $size -}}
{{- end -}}
