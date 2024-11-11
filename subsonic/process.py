from typing import TypedDict


class ScanState(TypedDict):
    fetched: int
    scanning: bool


from multiprocessing.sharedctypes import SynchronizedArray

from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Array
from subprocess import PIPE, Popen


class MetadataHandler:
    __slots__ = "executor", "scanStatus"

    def __init__(self) -> None:
        self.executor = ThreadPoolExecutor(1)
        self.scanStatus: SynchronizedArray[int] = Array("L", [0, 0])

        super().__init__()

    def get_state_json(self) -> ScanState:
        with self.scanStatus.get_lock():
            return {"fetched": self.scanStatus[0], "scanning": bool(self.scanStatus[1])}

    def submit_scan(self, full: bool) -> bool:
        with self.scanStatus.get_lock():
            if self.scanStatus[1]:
                return False

            self.executor.submit(self.scan, full)
            self.scanStatus[0] = 0
            self.scanStatus[1] = 1

            return True

    def scan(self, is_full: bool) -> None:
        args = ["python3", "database_sync.py"]
        if is_full:
            args.append("--full")

        process = Popen(args, stdout=PIPE, stderr=PIPE)

        self.scanStatus[0] = 0
        self.scanStatus[1] = 1

        while True:
            line = process.stdout.readline()

            if not line:
                break

            self.scanStatus[0] = int(line)

        errors = process.stderr.readlines()

        print(errors)
        self.scanStatus[1] = False
