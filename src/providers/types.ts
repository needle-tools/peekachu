export interface SecretProvider {
  readonly name: string;

  get(name: string, project?: string): Promise<string | null>;
  set(name: string, value: string, project?: string): Promise<void>;
  delete(name: string, project?: string): Promise<boolean>;
  list(project?: string): Promise<string[]>;
  has(name: string, project?: string): Promise<boolean>;
}
