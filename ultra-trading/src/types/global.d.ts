/// <reference types="@cloudflare/workers-types" />

declare global {
  // Fix for Hono's BufferSource type issue
  type BufferSource = ArrayBufferView | ArrayBuffer;
  
  // Fix for RequestInfo type
  type RequestInfo = Request | string | URL;
  
  // ContentfulStatusCode for Hono
  type ContentfulStatusCode = 
    | 200 | 201 | 202 | 203 | 204 | 205 | 206 
    | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308
    | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 
    | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 422 
    | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
    | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;
}

export {};