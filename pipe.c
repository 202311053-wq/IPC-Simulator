#include <stdio.h>
#include <stdlib.h>
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
    int pipefd[2];
    pid_t pid;
    char buffer[256];
    
    if (pipe(pipefd) == -1) {
        perror("pipe");
        return 1;
    }
    
    print_event("initialized", "parent", "Anonymous pipe created");
    
    pid = fork();
    
    if (pid == -1) {
        perror("fork");
        return 1;
    }
    
    if (pid == 0) {
        // Child process (reader)
        close(pipefd[1]);
        print_event("waiting", "child", "Waiting for data from pipe");
        
        int n = read(pipefd[0], buffer, sizeof(buffer) - 1);
        if (n > 0) {
            buffer[n] = '\0';
            char detail[256];
            sprintf(detail, "Received: %s", buffer);
            print_event("message_received", "child", detail);
        }
        
        close(pipefd[0]);
        print_event("complete", "child", "Child process done");
    } else {
        // Parent process (writer)
        close(pipefd[0]);
        
        sleep(1);
        
        const char* message = "Hello from parent process!";
        char detail[256];
        sprintf(detail, "Sending: %s", message);
        print_event("message_sent", "parent", detail);
        
        write(pipefd[1], message, strlen(message));
        close(pipefd[1]);
        
        waitpid(pid, NULL, 0);
        print_event("complete", "parent", "All processes completed");
    }
    
    return 0;
}
