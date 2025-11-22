CC = gcc
CFLAGS_BASE = -Wall -Wextra -lpthread -lrt
CFLAGS_VISUAL = $(CFLAGS_BASE) -DVISUAL

TARGETS = mutex binary_semaphore counting_semaphore spinlock rw_lock pipe named_pipe shared_memory message_queue
VISUAL_TARGETS = $(addsuffix _visual, $(TARGETS))

.PHONY: all visual-all clean

all: bin $(TARGETS)

visual-all: bin $(VISUAL_TARGETS)

%: %.c
	$(CC) $(CFLAGS_BASE) -o bin/$@ $<

%_visual: %.c
	$(CC) $(CFLAGS_VISUAL) -o bin/$@ $<

bin:
	mkdir -p bin

clean:
	rm -rf bin

.PHONY: run-mutex run-binary-sem run-counting-sem run-spinlock run-rw-lock run-pipe run-named-pipe run-shared-mem run-msg-queue

run-mutex: bin/mutex_visual
	./bin/mutex_visual

run-binary-sem: bin/binary_semaphore_visual
	./bin/binary_semaphore_visual

run-counting-sem: bin/counting_semaphore_visual
	./bin/counting_semaphore_visual

run-spinlock: bin/spinlock_visual
	./bin/spinlock_visual

run-rw-lock: bin/rw_lock_visual
	./bin/rw_lock_visual

run-pipe: bin/pipe_visual
	./bin/pipe_visual

run-named-pipe: bin/named_pipe_visual
	./bin/named_pipe_visual

run-shared-mem: bin/shared_memory_visual
	./bin/shared_memory_visual

run-msg-queue: bin/message_queue_visual
	./bin/message_queue_visual
