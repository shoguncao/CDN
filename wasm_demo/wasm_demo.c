#include <emscripten/emscripten.h>
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif
    
    int EMSCRIPTEN_KEEPALIVE csg_add_one(int a) {
        return a + 2;
    }
    
#ifdef __cplusplus
}
#endif
