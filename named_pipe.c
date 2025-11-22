#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <sys/stat.h>
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
    const char* fifo_path = "/tmp/ipc_fifo";
    char buffer[256];
    pid_t pid;
    
    remove(fifo_path);
    mkfifo(fifo_path, 0666);
    
    print_event("initialized", "parent", "Named pipe (FIFO) created");
    
    pid = fork();
    
    if (pid == 0) {
        // Child process (reader)
        sleep(1);
        print_event("waiting", "child", "Child opening FIFO for reading");
        
        int fd = open(fifo_path, O_RDONLY);
        print_event("reader_enter", "child", "Child acquired read access");
        
        int n = read(fd, buffer, sizeof(buffer) - 1);
        if (n > 0) {
            buffer[n] = '\0';
            char detail[256];
            sprintf(detail, "Received: %s", buffer);
            print_event("message_received", "child", detail);
        }
        
        close(fd);
        print_event("complete", "child", "Child process done");
    } else {
        // Parent process (writer)
        print_event("writer_enter", "parent", "Parent opening FIFO for writing");
        
        int fd = open(fifo_path, O_WRONLY);
        print_event("writing", "parent", "Parent acquired write access");
        
        const char* message = "Message through named pipe!";
        char detail[256];
        sprintf(detail, "Sending: %s", message);
        print_event("message_sent", "parent", detail);
        
        write(fd, message, strlen(message));
        close(fd);
        
        waitpid(pid, NULL, 0);
        print_event("complete", "parent", "All processes completed");
        
        remove(fifo_path);
    }
    
    return 0;
}
