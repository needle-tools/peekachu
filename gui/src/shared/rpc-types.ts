import type { RPCSchema } from "electrobun/bun";

export type PeekachuRPC = {
  bun: RPCSchema<{
    requests: {
      listProjects: {
        params: {};
        response: string[];
      };
      listSecrets: {
        params: { project: string };
        response: string[];
      };
      setSecret: {
        params: { project: string; name: string; value: string };
        response: void;
      };
      deleteSecret: {
        params: { project: string; name: string };
        response: boolean;
      };
      getStatus: {
        params: {};
        response: { platform: string; provider: string; node: string };
      };
      getComments: {
        params: { project: string };
        response: Record<string, string>;
      };
      setComment: {
        params: { project: string; name: string; comment: string };
        response: void;
      };
      createProject: {
        params: { project: string };
        response: void;
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
