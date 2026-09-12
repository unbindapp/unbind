import assert from "node:assert/strict";
import { test } from "node:test";

import { getTemplateHeadroom, templateHeadroomThresholds } from "./resource-headroom.ts";
import type { TServer } from "@/lib/queries/servers";

function server(overrides: Partial<TServer>): TServer {
  return {
    name: "server",
    ready: true,
    unschedulable: false,
    roles: [],
    created_at: "",
    os: "",
    architecture: "",
    kubernetes_version: "",
    internal_ip: "",
    external_ip: "",
    cpu_allocatable_millicores: 4000,
    cpu_requested_millicores: 0,
    memory_allocatable_megabytes: 8192,
    memory_requested_megabytes: 0,
    pod_count: 0,
    pod_capacity: 110,
    conditions: [],
    ...overrides,
  };
}

const twoCoresFourGb = { minimum_recommended_cpu: 2, minimum_recommended_ram_gb: 4 };

test("plenty of headroom is normal", () => {
  assert.deepEqual(getTemplateHeadroom([server({})], twoCoresFourGb), {
    level: "normal",
    recommendedCpuMillicores: 2000,
    recommendedMemoryMegabytes: 4096,
    availableCpuMillicores: 4000,
    availableMemoryMegabytes: 8192,
  });
});

test("ratio at the warning threshold is normal, just below is a warning", () => {
  const atThreshold = server({
    cpu_allocatable_millicores: 2000 * templateHeadroomThresholds.warning,
    memory_allocatable_megabytes: 4096 * templateHeadroomThresholds.warning,
  });
  assert.equal(getTemplateHeadroom([atThreshold], twoCoresFourGb).level, "normal");

  const justBelow = server({
    cpu_allocatable_millicores: 2000 * templateHeadroomThresholds.warning - 1,
    memory_allocatable_megabytes: 4096 * templateHeadroomThresholds.warning,
  });
  assert.equal(getTemplateHeadroom([justBelow], twoCoresFourGb).level, "warning");
});

test("ratio at the destructive threshold is a warning, just below is destructive", () => {
  const atThreshold = server({
    cpu_allocatable_millicores: 2000 * templateHeadroomThresholds.destructive,
    memory_allocatable_megabytes: 4096 * templateHeadroomThresholds.destructive,
  });
  assert.equal(getTemplateHeadroom([atThreshold], twoCoresFourGb).level, "warning");

  const justBelow = server({
    cpu_allocatable_millicores: 2000 * templateHeadroomThresholds.destructive - 1,
    memory_allocatable_megabytes: 4096 * templateHeadroomThresholds.destructive,
  });
  assert.equal(getTemplateHeadroom([justBelow], twoCoresFourGb).level, "destructive");
});

test("the worse of cpu and memory decides the level", () => {
  const cpuFineMemoryShort = server({
    cpu_allocatable_millicores: 16000,
    memory_allocatable_megabytes: 2048,
  });
  assert.equal(getTemplateHeadroom([cpuFineMemoryShort], twoCoresFourGb).level, "destructive");

  const memoryFineCpuTight = server({
    cpu_allocatable_millicores: 2500,
    memory_allocatable_megabytes: 65536,
  });
  assert.equal(getTemplateHeadroom([memoryFineCpuTight], twoCoresFourGb).level, "warning");
});

test("available is allocatable minus requested, summed across servers", () => {
  const result = getTemplateHeadroom(
    [
      server({ cpu_requested_millicores: 3000, memory_requested_megabytes: 6144 }),
      server({ cpu_requested_millicores: 3500, memory_requested_megabytes: 7168 }),
    ],
    twoCoresFourGb,
  );
  assert.deepEqual(result, {
    level: "destructive",
    recommendedCpuMillicores: 2000,
    recommendedMemoryMegabytes: 4096,
    availableCpuMillicores: 1500,
    availableMemoryMegabytes: 3072,
  });
});

test("over-committed servers count as zero, not negative", () => {
  const result = getTemplateHeadroom(
    [
      server({ cpu_requested_millicores: 9000, memory_requested_megabytes: 20000 }),
      server({ cpu_requested_millicores: 1000, memory_requested_megabytes: 2048 }),
    ],
    { minimum_recommended_cpu: 4, minimum_recommended_ram_gb: 8 },
  );
  assert.equal(result.availableCpuMillicores, 3000);
  assert.equal(result.availableMemoryMegabytes, 6144);
});

test("not ready and unschedulable servers are ignored", () => {
  const result = getTemplateHeadroom(
    [
      server({ ready: false }),
      server({ unschedulable: true }),
      server({ cpu_allocatable_millicores: 1000, memory_allocatable_megabytes: 1024 }),
    ],
    twoCoresFourGb,
  );
  assert.equal(result.level, "destructive");
  assert.equal(result.availableCpuMillicores, 1000);
  assert.equal(result.availableMemoryMegabytes, 1024);
});

test("no schedulable servers is destructive", () => {
  assert.equal(getTemplateHeadroom([], twoCoresFourGb).level, "destructive");
});

test("fractional recommendations round to whole millicores and megabytes", () => {
  const result = getTemplateHeadroom(
    [server({ cpu_allocatable_millicores: 100, memory_allocatable_megabytes: 100 })],
    { minimum_recommended_cpu: 0.5, minimum_recommended_ram_gb: 0.25 },
  );
  assert.equal(result.recommendedCpuMillicores, 500);
  assert.equal(result.recommendedMemoryMegabytes, 256);
});
