import type { ComponentManifest } from "../components/component-catalog.js";

export type LifecycleOperation = "install" | "update" | "backup" | "restore" | "uninstall";
export type LifecyclePlanAction = LifecycleOperation | "already-current" | "not-installed" | "conflict";
export type LifecycleResultAction = "installed" | "updated" | "backed-up" | "restored" | "uninstalled" | "already-current";

export interface LifecyclePlan {
  readonly componentId: string;
  readonly operation: LifecycleOperation;
  readonly action: LifecyclePlanAction;
  readonly targetPath: string;
  readonly reason?: string;
}

export interface LifecycleResult {
  readonly componentId: string;
  readonly action: LifecycleResultAction;
  readonly targetPath: string;
  readonly backupId?: string;
}

export interface ComponentBackup {
  readonly backupId: string;
  readonly componentId: string;
  readonly version: string;
  readonly createdAt: string;
}

export interface AgentAdapter {
  readonly agentId: string;
  supports(component: ComponentManifest): boolean;
  targetPath(projectRoot: string, component: ComponentManifest): string;
}

export interface ComponentInstaller {
  preview(projectRoot: string, componentId: string, operation?: LifecycleOperation, backupId?: string): Promise<LifecyclePlan>;
  install(projectRoot: string, componentId: string): Promise<LifecycleResult>;
  update(projectRoot: string, componentId: string): Promise<LifecycleResult>;
  backup(projectRoot: string, componentId: string): Promise<LifecycleResult>;
  listBackups(projectRoot: string, componentId: string): Promise<ReadonlyArray<ComponentBackup>>;
  restore(projectRoot: string, componentId: string, backupId: string): Promise<LifecycleResult>;
  uninstall(projectRoot: string, componentId: string): Promise<LifecycleResult>;
}
