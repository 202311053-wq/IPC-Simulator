#include <stdio.h>
#include <stdlib.h>
#include <semaphore.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/time.h>

sem_t binary_sem;

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

void* producer(void* arg) {
    const char* name = (const char*)arg;
    
    sleep(1);
    print_event("semaphore_post", name, "Producing item");
    sem_post(&binary_sem);
    print_event("message_sent", name, "Signal posted");
    
    return NULL;
}

void* consumer(void* arg) {
    const char* name = (const char*)arg;
    
    print_event("semaphore_wait", name, "Waiting for signal");
    sem_wait(&binary_sem);
    print_event("message_received", name, "Signal received");
    
    return NULL;
}

int main() {
    sem_init(&binary_sem, 0, 0);
    print_event("initialized", "parent", "Binary semaphore initialized with value 0");
    
    pthread_t producer_t, consumer_t;
    
    pthread_create(&consumer_t, NULL, consumer, "Consumer");
    sleep(0.1);
    pthread_create(&producer_t, NULL, producer, "Producer");
    
    pthread_join(producer_t, NULL);
    pthread_join(consumer_t, NULL);
    
    sem_destroy(&binary_sem);
    print_event("complete", "parent", "Binary semaphore test completed");
    
    return 0;
}
