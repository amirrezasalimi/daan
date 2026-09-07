import { execFile } from "node:child_process";
import { cpus, freemem, platform, totalmem } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface CpuTimes {
  idle: number;
  total: number;
}

export interface SystemResourceUsage {
  cpuPercent: number;
  processCpuPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  processMemoryBytes: number;
  gpu: {
    name: string;
    utilizationPercent: number;
    memoryUsedBytes: number;
    memoryAllocatedBytes: number;
  } | null;
  sampledAt: number;
}

let previousCpu = readCpuTimes();
let previousProcessCpu = process.cpuUsage();
let previousProcessSampleAt = performance.now();
let cachedGpu: SystemResourceUsage["gpu"] = null;
let gpuSampleAt = 0;

function readCpuTimes(): CpuTimes {
  return cpus().reduce(
    (result, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      return { idle: result.idle + cpu.times.idle, total: result.total + total };
    },
    { idle: 0, total: 0 },
  );
}

function sampleCpuPercent(): number {
  const current = readCpuTimes();
  const idleDelta = current.idle - previousCpu.idle;
  const totalDelta = current.total - previousCpu.total;
  previousCpu = current;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

function sampleProcessCpuPercent(): number {
  const now = performance.now();
  const usage = process.cpuUsage(previousProcessCpu);
  const elapsedMicros = (now - previousProcessSampleAt) * 1_000;
  previousProcessCpu = process.cpuUsage();
  previousProcessSampleAt = now;
  if (elapsedMicros <= 0) return 0;
  return Math.max(0, Math.min(100, ((usage.user + usage.system) / elapsedMicros) * 100));
}

function parseNumber(output: string, field: string): number | null {
  const match = output.match(new RegExp(`"${field}"=(\\d+)`));
  return match ? Number(match[1]) : null;
}

async function readMacGpu(): Promise<SystemResourceUsage["gpu"]> {
  try {
    const { stdout } = await execFileAsync(
      "ioreg",
      ["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"],
      {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        timeout: 2_000,
      },
    );
    const utilization = parseNumber(stdout, "Device Utilization %");
    const memoryUsed = parseNumber(stdout, "In use system memory");
    const memoryAllocated = parseNumber(stdout, "Alloc system memory");
    const name = stdout.match(/"model" = "([^"]+)"/)?.[1] ?? "Apple GPU";
    if (utilization === null || memoryUsed === null || memoryAllocated === null) return null;
    return {
      name,
      utilizationPercent: Math.max(0, Math.min(100, utilization)),
      memoryUsedBytes: memoryUsed,
      memoryAllocatedBytes: memoryAllocated,
    };
  } catch {
    return null;
  }
}

async function readGpu(): Promise<SystemResourceUsage["gpu"]> {
  const now = Date.now();
  if (now - gpuSampleAt < 1_000) return cachedGpu;
  gpuSampleAt = now;
  cachedGpu = platform() === "darwin" ? await readMacGpu() : null;
  return cachedGpu;
}

export async function getSystemResourceUsage(): Promise<SystemResourceUsage> {
  const memoryTotalBytes = totalmem();
  return {
    cpuPercent: sampleCpuPercent(),
    processCpuPercent: sampleProcessCpuPercent(),
    memoryUsedBytes: memoryTotalBytes - freemem(),
    memoryTotalBytes,
    processMemoryBytes: process.memoryUsage().rss,
    gpu: await readGpu(),
    sampledAt: Date.now(),
  };
}
