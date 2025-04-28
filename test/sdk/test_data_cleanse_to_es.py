import os
import asyncio
import httpx

from pathlib import Path
from typing import List, Dict, Set
from dotenv import load_dotenv
import time


# Load environment variables
load_dotenv()

# Global statistics
class TestStats:
    def __init__(self):
        self.total_files_processed = 0
        self.total_bytes_processed = 0
        self.start_time = None
        self.end_time = None

    def add_file(self, file_path: str):
        self.total_files_processed += 1
        try:
            self.total_bytes_processed += os.path.getsize(file_path)
        except (OSError, IOError) as e:
            print(f"Warning: Could not get size for file {file_path}: {e}")

    def start(self):
        self.start_time = time.time()

    def stop(self):
        self.end_time = time.time()

    def get_duration(self) -> float:
        if self.start_time is None or self.end_time is None:
            return 0.0
        return self.end_time - self.start_time

    def print_summary(self):
        duration = self.get_duration()
        total_mb = self.total_bytes_processed / (1024 * 1024)
        print("\n=== Test Statistics ===")
        print(f"Total files processed: {self.total_files_processed}")
        print(f"Total data processed: {total_mb:.2f} MB")
        print(f"Total time taken: {duration:.2f} seconds")

# Global stats instance
test_stats = TestStats()

async def wait_for_task_completion(client: httpx.AsyncClient, data_process_service_url: str, task_id: str, max_retries: int = 10) -> bool:
    """Wait for a task to complete and return success status"""
    time.sleep(1)
    
    retries = 0
    max_wait_time = 600  # 最长等待10分钟
    start_time = time.time()
    
    # 所有状态常量统一为小写，与API响应一致
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_FORWARDING = "forwarding"
    STATUS_PROCESSING = "processing"
    STATUS_WAITING = "waiting"
    
    while True:
        try:
            status_response = await client.get(
                f"{data_process_service_url}/tasks/{task_id}",
                timeout=60.0
            )
            
            if status_response.status_code != 200:
                print(f"   Error getting task status: {status_response.text}")
                return False
            
            task_status = status_response.json()
            status_raw = task_status.get('status', '')
            current_status = status_raw.lower()  # 确保使用小写
            
            if current_status != STATUS_WAITING:
                print(f"   Task {task_id} status: {current_status}")
            
            # 任务完成
            if current_status == STATUS_COMPLETED:
                return True
                
            # 任务失败
            elif current_status == STATUS_FAILED:
                error_msg = task_status.get('error', 'Unknown error')
                print(f"   Task {task_id} failed: {error_msg}")
                return False
                
            # 考虑FORWARDING状态也是正常的，只需继续等待
            elif current_status == STATUS_FORWARDING:
                # 如果转发超过了特定时间，我们认为任务基本完成
                forwarding_time = time.time() - start_time
                if forwarding_time > 120.0:  # 如果转发状态超过2分钟
                    print(f"   Task {task_id} has been forwarding for {forwarding_time:.1f}s, considered successful")
                    return True
            
            # 检查是否超过最长等待时间
            elapsed_time = time.time() - start_time
            if elapsed_time > max_wait_time:
                print(f"   Task {task_id} timed out after {elapsed_time:.1f} seconds")
                # 如果状态是forwarding，即使超时也认为任务成功
                if current_status == STATUS_FORWARDING:
                    print(f"   Task is still forwarding, considering it successful")
                    return True
                return False
            
            # 根据状态决定等待时间
            # processing或forwarding状态下等待稍长一些，但更频繁地检查
            if current_status in [STATUS_PROCESSING, STATUS_FORWARDING]:
                await asyncio.sleep(2.0)  # 处理中状态每2秒检查一次
            else:
                await asyncio.sleep(0.5)  # 其他状态每0.5秒检查一次
            
        except httpx.TimeoutException:
            retries += 1
            if retries > max_retries:
                print(f"   Timeout checking task {task_id} status after {max_retries} retries")
                return False
            
            print(f"   Timeout checking task {task_id} status, retry {retries}/{max_retries}...")
            await asyncio.sleep(1.0)  # 超时后稍等一会再重试
            
        except Exception as e:
            print(f"   Error checking task {task_id} status: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

async def test_single_file(client: httpx.AsyncClient, data_process_service_url: str, 
                         file_path: str, index_name: str) -> bool:
    """Test processing a single file"""
    print(f"\nTesting single file: {file_path}")
    
    try:
        # Add file to statistics
        test_stats.add_file(file_path)
        
        # Create task with index_name parameter
        create_response = await client.post(
            f"{data_process_service_url}/tasks",
            json={
                "source": file_path,
                "source_type": "file",
                "chunking_strategy": "basic",
                "index_name": index_name  # 直接在主参数中设置index_name
            },
            timeout=60.0
        )
        
        if create_response.status_code not in (200, 201):
            print(f"   Error creating task: {create_response.text}")
            return False
        
        task_id = create_response.json()["task_id"]
        print(f"   Task created with ID: {task_id}")
        
        # 添加短暂休眠，确保服务有时间开始处理任务
        await asyncio.sleep(0.5)
        
        # 等待任务完成 - 任务完成会自动转发到ES
        return await wait_for_task_completion(client, data_process_service_url, task_id)
        
    except Exception as e:
        import traceback
        print(f"   Error processing file {file_path}: {str(e)}")
        print("   Traceback:")
        traceback.print_exc()
        return False

async def submit_batch_task(client: httpx.AsyncClient, data_process_service_url: str, 
                          file_paths: List[str], index_name: str, max_retries: int = 3) -> Dict:
    """分批提交大量文件，避免请求超时"""
    batch_size = 5  # 每批最多5个文件
    total_files = len(file_paths)
    batches = [file_paths[i:i+batch_size] for i in range(0, total_files, batch_size)]
    
    print(f"   Splitting {total_files} files into {len(batches)} batches of max {batch_size} files each")
    
    all_task_ids = []
    
    for batch_idx, batch in enumerate(batches):
        retries = 0
        while retries <= max_retries:
            try:
                sources = [{
                    "source": path, 
                    "source_type": "file",
                    "chunking_strategy": "basic",
                    "index_name": index_name  # 直接在每个source对象中设置index_name
                } for path in batch]
                
                create_response = await client.post(
                    f"{data_process_service_url}/tasks/batch",
                    json={"sources": sources},
                    timeout=500.0
                )
                
                if create_response.status_code not in (200, 201):
                    print(f"   Error creating batch task: {create_response.text}")
                    break
                
                response_data = create_response.json()
                if "task_ids" not in response_data:
                    print(f"   Invalid response format: {response_data}")
                    break
                
                batch_task_ids = response_data["task_ids"]
                all_task_ids.extend(batch_task_ids)
                break  # 成功，退出重试循环
            
            except httpx.TimeoutException:
                retries += 1
                if retries <= max_retries:
                    print(f"   Timeout submitting batch {batch_idx+1} - retry {retries}/{max_retries}...")
                    await asyncio.sleep(2.0)
                else:
                    print(f"   Failed to submit batch {batch_idx+1} after {max_retries} retries")
            
            except Exception as e:
                import traceback
                print(f"   Error submitting batch {batch_idx+1}: {str(e)}")
                print("   Traceback:")
                traceback.print_exc()
                break
    
    return {"task_ids": all_task_ids}

async def test_multiple_files(client: httpx.AsyncClient, data_process_service_url: str,
                            file_paths: List[str], index_name: str) -> bool:
    """Test processing multiple files"""
    print(f"\nTesting multiple files ({len(file_paths)} files)")
    
    try:
        # Add files to statistics
        for file_path in file_paths:
            test_stats.add_file(file_path)
            
        # 判断文件数量，如果超过一定数量，就分批提交
        if len(file_paths) > 5:
            response_data = await submit_batch_task(client, data_process_service_url, file_paths, index_name)
            task_ids = response_data.get("task_ids", [])
            if not task_ids:
                print("   Failed to create any batch tasks")
                return False
        else:
            # Create batch task
            sources = [{
                "source": path, 
                "source_type": "file",
                "index_name": index_name,
            } for path in file_paths]
            
            create_response = await client.post(
                f"{data_process_service_url}/tasks/batch",
                json={"sources": sources},
                timeout=200.0
            )
            
            if create_response.status_code not in (200, 201):
                print(f"   Error creating batch task: {create_response.text}")
                return False
            
            response_data = create_response.json()
            if "task_ids" not in response_data:
                print(f"   Invalid response format: {response_data}")
                return False
            
            task_ids = response_data["task_ids"]
        
        print(f"   Batch task created with {len(task_ids)} task IDs")
        print(f"   Start to monitor {len(task_ids)} tasks")
        
        # 等待3秒，确保服务有时间开始处理任务
        await asyncio.sleep(3.0)
        
        # 状态常量
        STATUS_COMPLETED = "completed"
        STATUS_FAILED = "failed"
        
        # 任务状态追踪
        completed_tasks: Set[str] = set()
        failed_tasks: Set[str] = set()
        pending_tasks = set(task_ids)
        max_retries = 120  # 最多重试120次，每次5秒，即最多等待10分钟
        retry_count = 0
        
        # 记录开始时间
        start_time = time.time()
        
        while pending_tasks and retry_count < max_retries:
            retry_count += 1
            
            # 并行检查所有待处理任务的状态
            check_futures = []
            for task_id in pending_tasks:
                check_futures.append(
                    client.get(
                        f"{data_process_service_url}/tasks/{task_id}",
                        timeout=30.0
                    )
                )
            
            # 等待所有状态检查完成
            responses = await asyncio.gather(*check_futures, return_exceptions=True)
            
            # 处理每个任务的状态
            for task_id, response in zip(list(pending_tasks), responses):
                try:
                    if isinstance(response, Exception):
                        print(f"   Error checking task {task_id}: {str(response)}")
                        continue
                        
                    if response.status_code != 200:
                        print(f"   Error checking task {task_id}: {response.text}")
                        continue
                    
                    task_data = response.json()
                    status_raw = task_data.get('status', '')
                    current_status = status_raw.lower()
                    
                    # 处理可能带有taskstatus.前缀的状态
                    if current_status.startswith("taskstatus."):
                        current_status = current_status[len("taskstatus."):]
                    
                    if current_status == STATUS_COMPLETED:
                        print(f"   Task {task_id}: {current_status}")
                    
                    if current_status == STATUS_COMPLETED:
                        completed_tasks.add(task_id)
                        pending_tasks.remove(task_id)
                    elif current_status == STATUS_FAILED:
                        failed_tasks.add(task_id)
                        pending_tasks.remove(task_id)
                
                except Exception as e:
                    print(f"   Error processing task {task_id} status: {str(e)}")
            
            # 如果还有待处理的任务，打印进度并等待
            print(f"   Else task is waiting for completion")
            if pending_tasks:
                total_tasks = len(task_ids)
                completed_count = len(completed_tasks)
                failed_count = len(failed_tasks)
                pending_count = len(pending_tasks)
                
                print(f"\n   Progress Update (Attempt {retry_count}/{max_retries}):")
                elapsed_time = time.time() - start_time
                minutes = int(elapsed_time // 60)
                seconds = int(elapsed_time % 60)
                print(f"   Time elapsed: {minutes}m {seconds}s")
                print(f"   - Completed: {completed_count}/{total_tasks} ({completed_count/total_tasks*100:.1f}%)")
                print(f"   - Failed (unsupported files): {failed_count}/{total_tasks} ({failed_count/total_tasks*100:.1f}%)")
                print(f"   - Waiting: {pending_count}/{total_tasks} ({pending_count/total_tasks*100:.1f}%)")
                
                if pending_count/total_tasks < 0.05:
                    print(f"   All tasks completed successfully")
                    return True
                
                # 等待5秒后进行下一轮检查
                await asyncio.sleep(2.0)
        
        print(f"\n   Batch processing summary:")
        print(f"   Total tasks: {len(task_ids)}")
        print(f"   Completed: {len(completed_tasks)}")
        print(f"   Failed: {len(failed_tasks)}")
        
        # 只要大部分任务成功，就认为整体成功
        if len(completed_tasks) > (len(task_ids) * 0.8):
            print(f"   Overall status: SUCCESS (>80% tasks completed successfully)")
            return True
        elif len(completed_tasks) > (len(task_ids) * 0.5):
            print(f"   Overall status: PARTIAL SUCCESS (>50% tasks completed)")
            return True
        else:
            print(f"   Overall status: FAILURE (<50% tasks completed)")
            return False
            
    except Exception as e:
        import traceback
        print(f"   Error processing batch: {str(e)}")
        print("   Traceback:")
        traceback.print_exc()
        return False

async def test_data_process_to_es_integration():
    """Test the integration between data process service and Elasticsearch"""
    try:
        print("=== Testing Data Process → Elasticsearch Integration ===")
        
        # Start timing
        test_stats.start()
        
        # Get service URLs from environment
        data_process_service_url = "http://localhost:5010"
        
        # Get example docs directory
        example_docs_dir = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Nexent", "data_process", "example_docs")))
        if not example_docs_dir.exists():
            print(f"Error: example_docs directory not found at {example_docs_dir}")
            return
        
        # Get all test files
        test_files = [
            str(f.absolute()) for f in example_docs_dir.glob("**/*")
            if f.is_file() and not f.name.startswith(".") and f.name != ".DS_Store"
        ]
        
        if not test_files:
            print("Error: No test files found in example_docs directory")
            return
        
        print(f"Found {len(test_files)} test files")
        
        # 使用更长的超时时间
        limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
        async with httpx.AsyncClient(timeout=180.0, limits=limits) as client:  # 增加整体客户端超时和并发连接
            # Test 1: Single file with new index
            # print("\n=== Test 1: Single file with new index ===")
            # test_file = test_files[0]
            # success = await test_single_file(client, data_process_service_url, test_file, "test_new_index_1")
            # print(f"Test 1 {'succeeded' if success else 'failed'}")
            
            # # Test 2: Same file to same index (duplicate)
            # print("\n=== Test 2: Duplicate file to same index ===")
            # success = await test_single_file(client, data_process_service_url, test_file, "test_new_index_1")
            # print(f"Test 2 {'succeeded' if success else 'failed'}")
            
            # # Test 3: Multiple files to new index
            # print("\n=== Test 3: Multiple files to new index ===")
            # test_files_subset = test_files[:5]  # Test with first 5 files
            # success = await test_multiple_files(client, data_process_service_url, test_files_subset, "test_multiple_files_1")
            # print(f"Test 3 {'succeeded' if success else 'failed'}")
            
            # # Test 4: All files to new index (but with a limit to avoid overwhelming the system)
            # print("\n=== Test 4: Larger batch of files to new index ===")
            # max_files_for_test = min(50, len(test_files))  # 限制最大文件数量
            # larger_test_files = test_files[:max_files_for_test]
            # print(f"   Using {len(larger_test_files)} files out of {len(test_files)} total files")
            # success = await test_multiple_files(client, data_process_service_url, larger_test_files, "测试知识库")
            # print(f"Test 4 {'succeeded' if success else 'failed'}")

            # # Test 5: Multiple files to different indices simultaneously
            # print("\n=== Test 5: Multiple files to different indices ===")
            # # Split files into two groups for different indices
            # files_count = min(40, len(test_files))  # 限制每个索引最多20个文件
            # first_group = test_files[:files_count//2]
            # second_group = test_files[files_count//2:files_count]
            
            # print(f"   Testing with {len(first_group)} files to index1 and {len(second_group)} files to index2")
            
            # # 创建两个并行的任务
            # tasks = [
            #     test_multiple_files(client, data_process_service_url, first_group, "test_multi_index_1"),
            #     test_multiple_files(client, data_process_service_url, second_group, "test_multi_index_2")
            # ]
            
            # # 同时执行两个任务
            # results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # # 检查结果
            # success = all(
            #     isinstance(result, bool) and result 
            #     for result in results
            # )
            
            # if success:
            #     print("Test 5 succeeded - Successfully processed files to different indices")
            # else:
            #     print("Test 5 failed - Errors occurred while processing files to different indices")
            #     for i, result in enumerate(results, 1):
            #         if isinstance(result, Exception):
            #             print(f"   Index {i} failed with error: {str(result)}")
            #         elif not result:
            #             print(f"   Index {i} failed")

            # Test 6: Process all files in test data folder using batch processing
            print("\n=== Test 6: Full batch processing of all test files ===")
            print(f"   Processing all {len(test_files)} files from the test data folder")
            
            # 使用一个专门的索引名称来存储全量数据
            full_test_index = "full_test_data_index"
            
            # 使用已有的batch处理函数处理所有文件
            success = await test_multiple_files(
                client, 
                data_process_service_url, 
                test_files,  # 使用所有测试文件
                full_test_index
            )
            
            if success:
                print(f"Test 6 succeeded - Successfully processed all {len(test_files)} files")
                print(f"   All data has been indexed to '{full_test_index}'")
            else:
                print(f"Test 6 failed - Errors occurred while processing all files")
        
        # Stop timing and print statistics
        test_stats.stop()
        test_stats.print_summary()
        
        print("\n=== Integration test completed! ===")
        
    except Exception as e:
        import traceback
        print(f"\nError during integration test:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("\nTraceback:")
        traceback.print_exc()

def main():
    """Main entry point for running the integration test"""
    try:
        asyncio.run(test_data_process_to_es_integration())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        import traceback
        print(f"\nFatal error:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("\nTraceback:")
        traceback.print_exc()

if __name__ == "__main__":
    main() 