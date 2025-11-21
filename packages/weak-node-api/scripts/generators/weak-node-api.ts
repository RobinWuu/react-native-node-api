import type { FunctionDecl } from "../../src/node-api-functions.js";
import { generateFunction } from "./shared.js";

export function generateHeader() {
  return `
    #pragma once

    #include <node_api.h>
    #include <stdio.h> // fprintf()
    #include <stdlib.h> // abort()
    
    #include "NodeApiHost.hpp"
    
    typedef NodeApiHost* (*NodeApiHostGetter)(node_api_basic_env env);
    extern "C" void inject_weak_node_api_host_getter(NodeApiHostGetter host_getter);

    typedef void(*InjectHostFunction)(const NodeApiHost&);
    extern "C" void inject_weak_node_api_host(const NodeApiHost& host);
  `;
}

function generateFunctionImpl(fn: FunctionDecl) {
  const { name, returnType, argumentTypes, needEnv } = fn;
  return generateFunction({
    ...fn,
    extern: true,
    body: `
        NodeApiHost* host = g_host_getter(${needEnv ? "arg0" : "nullptr"});
        if (host->${name} == nullptr) {
          fprintf(stderr, "Node-API function '${name}' called before it was injected!\\n");
          abort();
        }
        ${returnType === "void" ? "" : "return "} host->${name}(
          ${argumentTypes.map((_, index) => `arg${index}`).join(", ")}
        );
      `,
  });
}

export function generateSource(functions: FunctionDecl[]) {
  return `
    #include "weak_node_api.hpp"

    /**
     * @brief Global instance of the injected Node-API host.
     *
     * This variable holds the function table for Node-API calls.
     * It is set via inject_weak_node_api_host() before any Node-API function is dispatched.
     * All Node-API calls are routed through this host.
     */

    NodeApiHostGetter g_host_getter;

    void inject_weak_node_api_host_getter(NodeApiHostGetter host_getter) { g_host_getter = host_getter; };

    NodeApiHost g_host;
    void inject_weak_node_api_host(const NodeApiHost& host) {
      g_host = host;
    };
    
    // Generate function calling into the host
    ${functions.map(generateFunctionImpl).join("\n")}
  `;
}
