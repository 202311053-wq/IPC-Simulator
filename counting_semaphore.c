#include <stdio.h>
#include <stdlib.h>
#include <semaphore.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/time.h>

sem_t counting_sem;

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
    int id = *(int*)arg;
    char buf[64];
    
    sleep(1);
    sprintf(buf, "Produced resource #%d", id);
    print_event("semaphore_post", "Producer", buf);
    sem_post(&counting_sem);
    print_event("message_sent", "Producer", buf);
    
    free(arg);
    return NULL;
}

void* consumer(void* arg) {
    int id = *(int*)arg;
    char buf[64];
    
    sprintf(buf, "Waiting for resource #%d", id);
    print_event("semaphore_wait", "Consumer", buf);
    sem_wait(&counting_sem);
    sprintf(buf, "Consumed resource #%d", id);
    print_event("message_received", "Consumer", buf);
    
    free(arg);
    return NULL;
}

int main() {
    sem_init(&counting_sem, 0, 0);
    print_event("initialized", "parent", "Counting semaphore initialized with value 0");
    
    pthread_t threads[5];
    
    for (int i = 0; i < 3; i++) {
        int* id = malloc(sizeof(int));
        *id = i + 1;
        pthread_create(&threads[i], NULL, consumer, id);
    }
    
    sleep(0.5);
    
    for (int i = 0; i < 3; i++) {
        int* id = malloc(sizeof(int));
        *id = i + 1;
        pthread_create(&threads[3 + i], NULL, producer, id);
    }
    
    for (int i = 0; i < 6; i++) {
        pthread_join(threads[i], NULL);
    }
    
    sem_destroy(&counting_sem);
    print_event("complete", "parent", "Counting semaphore test completed");
    
    return 0;
}
