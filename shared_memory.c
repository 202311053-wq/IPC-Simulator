#include <stdio.h>
#include <stdlib.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <unistd.h>
#include <string.h>
#include <sys/time.h>
#include <sys/wait.h>

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

int main() {
    key_t key = ftok("/tmp", 'R');
    int shmid = shmget(key, 1024, IPC_CREAT | 0666);
    
    if (shmid < 0) {
        perror("shmget");
        return 1;
    }
    
    print_event("initialized", "parent", "Shared memory segment created");
    
    char* shared_data = (char*) shmat(shmid, NULL, 0);
    if (shared_data == (char*) -1) {
        perror("shmat");
        return 1;
    }
    
    print_event("shared_memory_update", "parent", "Parent attached to shared memory");
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child process
        char* child_data = (char*) shmat(shmid, NULL, 0);
        print_event("shared_memory_update", "child", "Child attached to shared memory");
        
        sleep(1);
        char detail[256];
        sprintf(detail, "Child read: %s", child_data);
        print_event("message_received", "child", detail);
        
        shmdt(child_data);
        print_event("complete", "child", "Child detached from shared memory");
    } else {
        // Parent process
        sleep(0.5);
        const char* message = "Data from parent process";
        strcpy(shared_data, message);
        char detail[256];
        sprintf(detail, "Parent wrote: %s", message);
        print_event("message_sent", "parent", detail);
        
        sleep(2);
        
        shmdt(shared_data);
        shmctl(shmid, IPC_RMID, NULL);
        
        waitpid(pid, NULL, 0);
        print_event("complete", "parent", "All processes completed");
    }
    
    return 0;
}
