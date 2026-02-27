export interface SecretProvider {
  readonly name: string;

  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<boolean>;
  list(): Promise<string[]>;
  has(name: string): Promise<boolean>;
}
