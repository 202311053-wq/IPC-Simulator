#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/time.h>

pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
int shared_resource = 0;

long get_ms() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

void print_event(const char* event, const char* process, const char* detail) {
#ifdef VISUAL
    printf("{\"event\":\"%s\",\"process\":\"%s\",\"detail\":\"%s\",\"timestamp\":%ld}\n", 
           event, process, detail, get_ms());
#else
    printf("[%s] %s: %s\n", event, process, detail);
#endif
}

void* worker(void* arg) {
    const char* name = (const char*)arg;
    
    print_event("waiting", name, "Waiting for mutex lock");
    
    pthread_mutex_lock(&mutex);
    print_event("lock_acquired", name, "Acquired mutex lock");
    
    shared_resource++;
    print_event("resource_update", name, "Incremented shared resource");
    
    sleep(1);
    
    pthread_mutex_unlock(&mutex);
    print_event("lock_released", name, "Released mutex lock");
    
    return NULL;
}

int main() {
    pthread_t t1, t2, t3;
    
    print_event("initialized", "parent", "Mutex initialized");
    
    pthread_create(&t1, NULL, worker, "P1");
    pthread_create(&t2, NULL, worker, "P2");
    pthread_create(&t3, NULL, worker, "P3");
    
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
    pthread_join(t3, NULL);
    
    print_event("complete", "parent", "All threads completed");
    printf("Final resource value: %d\n", shared_resource);
    
    return 0;
}
