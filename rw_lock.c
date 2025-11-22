#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/time.h>

pthread_rwlock_t rw_lock = PTHREAD_RWLOCK_INITIALIZER;
int shared_data = 0;

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

void* reader(void* arg) {
    const char* name = (const char*)arg;
    
    print_event("reader_enter", name, "Requesting read lock");
    pthread_rwlock_rdlock(&rw_lock);
    print_event("reading", name, "Acquired read lock, reading data");
    
    char detail[64];
    sprintf(detail, "Read value: %d", shared_data);
    print_event("message_received", name, detail);
    
    sleep(1);
    
    pthread_rwlock_unlock(&rw_lock);
    print_event("lock_released", name, "Released read lock");
    
    return NULL;
}

void* writer(void* arg) {
    const char* name = (const char*)arg;
    
    print_event("writer_enter", name, "Requesting write lock");
    pthread_rwlock_wrlock(&rw_lock);
    print_event("writing", name, "Acquired write lock, updating data");
    
    shared_data++;
    char detail[64];
    sprintf(detail, "Updated value to: %d", shared_data);
    print_event("resource_update", name, detail);
    
    sleep(1);
    
    pthread_rwlock_unlock(&rw_lock);
    print_event("lock_released", name, "Released write lock");
    
    return NULL;
}

int main() {
    print_event("initialized", "parent", "RW Lock initialized");
    
    pthread_t r1, r2, w1;
    
    pthread_create(&r1, NULL, reader, "Reader1");
    pthread_create(&r2, NULL, reader, "Reader2");
    sleep(0.5);
    pthread_create(&w1, NULL, writer, "Writer1");
    
    pthread_join(r1, NULL);
    pthread_join(r2, NULL);
    pthread_join(w1, NULL);
    
    print_event("complete", "parent", "RW Lock test completed");
    printf("Final value: %d\n", shared_data);
    
    return 0;
}
