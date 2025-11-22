#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/time.h>

volatile int spinlock = 0;
int shared_value = 0;

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

void spinlock_lock() {
    while (__sync_lock_test_and_set(&spinlock, 1)) {
        print_event("spin_wait", "thread", "Spinning waiting for lock");
    }
}

void spinlock_unlock() {
    __sync_lock_release(&spinlock);
}

void* worker(void* arg) {
    const char* name = (const char*)arg;
    
    print_event("spin_wait", name, "Attempting to acquire spinlock");
    
    spinlock_lock();
    print_event("lock_acquired", name, "Acquired spinlock");
    
    shared_value++;
    char detail[64];
    sprintf(detail, "Updated value to %d", shared_value);
    print_event("resource_update", name, detail);
    
    usleep(500000);
    
    spinlock_unlock();
    print_event("lock_released", name, "Released spinlock");
    
    return NULL;
}

int main() {
    print_event("initialized", "parent", "Spinlock initialized");
    
    pthread_t t1, t2;
    
    pthread_create(&t1, NULL, worker, "P1");
    pthread_create(&t2, NULL, worker, "P2");
    
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
    
    print_event("complete", "parent", "Spinlock test completed");
    printf("Final value: %d\n", shared_value);
    
    return 0;
}
