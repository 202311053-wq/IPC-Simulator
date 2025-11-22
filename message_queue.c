#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ipc.h>
#include <sys/msg.h>
#include <unistd.h>
#include <sys/time.h>
#include <sys/wait.h>

typedef struct {
    long mtype;
    char mtext[256];
} Message;

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
    key_t key = ftok("/tmp", 'M');
    int msgid = msgget(key, IPC_CREAT | 0666);
    
    if (msgid < 0) {
        perror("msgget");
        return 1;
    }
    
    print_event("initialized", "parent", "Message queue created");
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Receiver process
        Message msg;
        
        print_event("queue_receive", "receiver", "Waiting for message in queue");
        
        if (msgrcv(msgid, &msg, sizeof(msg.mtext), 1, 0) < 0) {
            perror("msgrcv");
        } else {
            char detail[256];
            sprintf(detail, "Received: %s", msg.mtext);
            print_event("message_received", "receiver", detail);
        }
        
        print_event("complete", "receiver", "Receiver process done");
    } else {
        // Sender process
        Message msg;
        msg.mtype = 1;
        
        sleep(1);
        
        strcpy(msg.mtext, "Hello from message queue!");
        char detail[256];
        sprintf(detail, "Sending: %s", msg.mtext);
        print_event("queue_send", "sender", detail);
        
        if (msgsnd(msgid, &msg, sizeof(msg.mtext), 0) < 0) {
            perror("msgsnd");
        }
        
        sleep(1);
        
        waitpid(pid, NULL, 0);
        
        msgctl(msgid, IPC_RMID, NULL);
        print_event("complete", "parent", "All processes completed");
    }
    
    return 0;
}
