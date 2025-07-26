import os
import subprocess
import glob
import sys
import logging

# Configure logger
logger = logging.getLogger("run_all_test")
logger.setLevel(logging.INFO)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

def install_required_packages():
    """Install required packages if not available"""
    packages_to_install = []
    
    # Check for pytest-cov
    try:
        import pytest_cov
    except ImportError:
        packages_to_install.append("pytest-cov")
    
    # Check for coverage
    try:
        import coverage
    except ImportError:
        packages_to_install.append("coverage")
    
    if packages_to_install:
        logger.info(f"Installing required packages: {', '.join(packages_to_install)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + packages_to_install)
            return True
        except subprocess.CalledProcessError:
            logger.error(f"Failed to install packages: {', '.join(packages_to_install)}")
            return False
    return True


def run_tests():
    """Find and run all test files in the app directory using pytest with coverage"""
    # Get the script directory path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Get project root directory (Nexent)
    project_root = os.path.abspath(os.path.join(current_dir, "../.."))
    
    # Get the test directories path using relative path
    app_test_dir = os.path.join(current_dir, "app")
    services_test_dir = os.path.join(current_dir, "services")
    utils_test_dir = os.path.join(current_dir, "utils")

    test_files = []
    
    # Check and collect test files from app directory
    if os.path.exists(app_test_dir):
        app_test_files = glob.glob(os.path.join(app_test_dir, "test_*.py"))
        test_files.extend(app_test_files)
    else:
        logger.warning(f"Directory not found: {app_test_dir}")
    
    # Check and collect test files from services directory
    if os.path.exists(services_test_dir):
        services_test_files = glob.glob(os.path.join(services_test_dir, "test_*.py"))
        test_files.extend(services_test_files)
    else:
        logger.warning(f"Directory not found: {services_test_dir}")

    # Check and collect test files from utils directory
    if os.path.exists(utils_test_dir):
        utils_test_files = glob.glob(os.path.join(utils_test_dir, "test_*.py"))
        test_files.extend(utils_test_files)
    else:
        logger.warning(f"Directory not found: {utils_test_dir}")
    
    if not test_files:
        logger.warning(f"No test files found in {app_test_dir} or {services_test_dir}")
        return False
    
    logger.info(f"Found {len(test_files)} test files to run")
    logger.info(f"Running tests from project root: {project_root}")
    
    # Change to project root directory
    os.chdir(project_root)
    
    # Install required packages
    if not install_required_packages():
        logger.error("Failed to install required packages. Exiting.")
        return False
    
    # Coverage data file path
    coverage_data_file = os.path.join(current_dir, '.coverage')
    config_file = os.path.join(current_dir, '.coveragerc')
    
    # Delete old coverage data if it exists
    if os.path.exists(coverage_data_file):
        try:
            os.remove(coverage_data_file)
            logger.info("Removed old coverage data.")
        except Exception as e:
            logger.warning(f"Could not remove old coverage data: {e}")
    
    # Results tracking
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    test_results = []
    
    # Define backend source directory for coverage
    backend_source = os.path.join(project_root, 'backend')
    
    # Define coverage omit patterns
    omit_patterns = [
        '*/test*',
        '*/tests/*',
        '*/__pycache__/*',
        '*/venv/*',
        '*/env/*',
        '*/.venv/*',
        '*/__init__.py'
    ]
    
    # Generate command line arguments for pytest-cov
    omit_args = ",".join(omit_patterns)
    
    # Run each test file with pytest-cov
    for test_file in test_files:
        # Get test file path relative to project root
        rel_path = os.path.relpath(test_file, project_root)
        # Replace backslashes with forward slashes for pytest
        rel_path = rel_path.replace("\\", "/")
        
        logger.info(f"\nRunning tests in {rel_path}")
        logger.info("-" * 50)
        
        # Run the test using pytest with coverage from project root
        # Use --cov to specify backend directory
        # Use --cov-append to append coverage data across runs
        cmd = [
            sys.executable, 
            "-m", 
            "pytest", 
            rel_path, 
            "-v", 
            f"--cov={backend_source}", 
            f"--cov-report=", 
            "--cov-append",
            "--cov-config=test/backend/.coveragerc",  # Use the config file
        ]
        
        # Add omit patterns through environment variable to avoid command line length issues
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{project_root}:{env.get('PYTHONPATH', '')}"
        env["COVERAGE_FILE"] = coverage_data_file
        env["COVERAGE_PROCESS_START"] = "True"
        
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        
        # Print the output
        logger.info(result.stdout)
        if result.stderr:
            logger.error("Errors:")
            logger.error(result.stderr)
        
        # Check if any tests actually failed (not just warnings)
        test_failed = False
        if result.returncode != 0:
            # Check output for failed tests vs just warnings
            test_failed = (" failed " in result.stdout or 
                           " FAILED " in result.stdout or 
                           "ERROR " in result.stdout or 
                           "ImportError" in result.stdout or 
                           "ModuleNotFoundError" in result.stdout)
        
        # Count tests and results
        test_info = {
            'file': rel_path,
            'success': result.returncode == 0 or (not test_failed),  # Success if returncode is 0 or only warnings
            'output': result.stdout
        }
        test_results.append(test_info)
        
        # Parse pytest output to get test counts
        file_total = file_passed = file_failed = 0

        # First, get the collected count
        for line in result.stdout.split('\n'):
            if line.strip().startswith('collecting ... collected '):
                try:
                    file_total = int(line.strip().split('collecting ... collected ')[1].split()[0])
                except (IndexError, ValueError):
                    pass

        # Look for the summary line at the end of the test run
        for line in result.stdout.split('\n'):
            # Match patterns like "10 passed in 0.05s" or "17 passed, 13 warnings in 2.49s"
            if " passed" in line and " in " in line:
                parts = line.strip().split()
                try:
                    # Find the position of "passed" word
                    for i, part in enumerate(parts):
                        if "passed" in part:
                            file_passed = int(parts[i-1])
                            break
                    # Find the position of "failed" word if it exists
                    for i, part in enumerate(parts):
                        if "failed" in part:
                            file_failed = int(parts[i-1])
                            break
                except (IndexError, ValueError):
                    pass
        
        # If we couldn't determine the number of collected tests from the output,
        # use the sum of passed and failed as the total
        if file_total == 0 and (file_passed > 0 or file_failed > 0):
            file_total = file_passed + file_failed
            
        # Special case: If we have an import error or collection error,
        # count it as at least one failed test
        if test_failed and "ImportError" in result.stdout or "ERROR collecting" in result.stdout:
            if file_total == 0:
                # If no tests were collected, count the file as having one test that failed
                file_total = 1
                file_failed = 1
                
                # Try to count the actual number of test methods in the file
                try:
                    with open(os.path.join(project_root, rel_path), 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Count test methods in unittest style tests
                        test_methods = [line for line in content.split('\n') if line.strip().startswith('def test_')]
                        if test_methods:
                            file_total = len(test_methods)
                            file_failed = file_total  # All tests in the file are considered failed
                except Exception:
                    # If counting fails, stick with the default of 1
                    pass

        total_tests += file_total
        passed_tests += file_passed
        failed_tests += file_failed

    # Generate test summary report
    logger.info("\n" + "=" * 60)
    logger.info("Test Summary")
    logger.info("=" * 60)
    
    # Print per-file results
    for test_result in test_results:
        status = "✅ PASSED" if test_result['success'] else "❌ FAILED"
        logger.info(f"{status} - {test_result['file']}")
    
    # Calculate pass rate
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    logger.info("\nTest Results:")
    logger.info(f"  Total Tests: {total_tests}")
    logger.info(f"  Passed: {passed_tests}")
    logger.info(f"  Failed: {failed_tests}")
    logger.info(f"  Pass Rate: {pass_rate:.1f}%")
    
    # Generate error report if there are failures
    if failed_tests > 0:
        generate_error_report(test_results)
    
    # Generate coverage reports
    logger.info("\n" + "=" * 60)
    logger.info("Code Coverage Report")
    logger.info("=" * 60)
    
    try:
        # Use coverage API to generate reports from the collected data
        import coverage
        cov = coverage.Coverage(
            data_file=coverage_data_file,
            config_file=config_file
        )
        cov.load()
        
        # Get measured files and check if they exist
        measured_files = cov.get_data().measured_files()
        missing_files = []
        for file_path in measured_files:
            if not os.path.exists(file_path):
                missing_files.append(file_path)
                logger.warning(f"Source file not found: {file_path}")
        
        if missing_files:
            logger.warning(f"\nFound {len(missing_files)} missing source files")
            logger.warning("Coverage report may be incomplete")
            
            # Remove missing files from coverage data
            logger.info("Attempting to exclude missing files from coverage reports...")
            # Create a temporary copy of the config
            temp_config = os.path.join(current_dir, '.coveragerc.tmp')
            with open(config_file, 'r') as src, open(temp_config, 'w') as dst:
                for line in src:
                    dst.write(line)
                # Add explicit omit rules for missing files
                dst.write("\n# Additional files to omit (added automatically)\n")
                for file_path in missing_files:
                    dst.write(f"    {file_path}\n")
            
            # Reload coverage with the updated config
            try:
                logger.info("Reloading coverage with updated configuration...")
                cov = coverage.Coverage(
                    data_file=coverage_data_file,
                    config_file=temp_config
                )
                cov.load()
                logger.info("Successfully reloaded coverage data with updated config")
            except Exception as e:
                logger.warning(f"Failed to reload coverage with updated config: {e}")
                # Continue with the original coverage object
        
        # Console report
        try:
            total_coverage = cov.report(show_missing=True)
            logger.info(f"\nTotal Coverage: {total_coverage:.1f}%")
            
            # Generate HTML report
            html_dir = os.path.join(current_dir, 'coverage_html')
            cov.html_report(directory=html_dir)
            logger.info(f"\nHTML coverage report generated in: {html_dir}")
            
            # Generate XML report
            xml_file = os.path.join(current_dir, 'coverage.xml')
            cov.xml_report(outfile=xml_file)
            logger.info(f"XML coverage report generated: {xml_file}")
        except Exception as e:
            logger.error(f"Error generating coverage reports after data cleanup: {e}")
    except Exception as e:
        if "No data to report" in str(e) or "No data was collected" in str(e):
            logger.info("No coverage data collected. This might be because:")
            logger.info("1. No backend modules were imported during tests")
            logger.info("2. All tested modules are mocked")
            logger.info("3. Tests are not actually calling the backend code")
        else:
            logger.error(f"Error generating coverage report: {e}")
            
            # Additional debugging for missing source files
            if "No source for code" in str(e):
                file_path = str(e).split("'")[1] if "'" in str(e) else "unknown"
                logger.error(f"The file exists: {os.path.exists(file_path)}")
                logger.error("Possible solutions:")
                logger.error("1. Make sure the file exists at the path shown in the error")
                logger.error("2. Check if the PYTHONPATH includes the directory containing this file")
                logger.error("3. Try running tests with absolute imports instead of relative imports")
                logger.error("4. Add a .coveragerc file with [paths] section to map source paths")
    
    print("\nAll tests completed")
    return True


def generate_error_report(test_results):
    """Generate a detailed report for failed tests"""
    failed_tests = [test for test in test_results if not test['success']]
    
    if not failed_tests:
        return
    
    logger.info("\n" + "=" * 60)
    logger.info("Test Error Report")
    logger.info("=" * 60)
    
    for index, test in enumerate(failed_tests):
        file_path = test['file']
        output = test['output']
        
        logger.info(f"\n{index + 1}. File: {file_path}")
        logger.info("-" * 40)
        
        # Extract error information from output
        error_lines = []
        capture_error = False
        
        for line in output.split('\n'):
            # Start capturing at ERROR or FAIL sections
            if line.strip().startswith("=") and ("ERROR" in line or "FAIL" in line):
                capture_error = True
                error_lines.append(line)
            # Stop at the short test summary
            elif line.strip().startswith("=== short test summary"):
                error_lines.append(line)
                break
            # Add lines while capturing
            elif capture_error:
                error_lines.append(line)
        
        # If we didn't capture specific errors, look for traceback
        if not error_lines:
            capture_error = False
            for line in output.split('\n'):
                if "Traceback" in line:
                    capture_error = True
                if capture_error:
                    error_lines.append(line)
                    if len(error_lines) > 15:  # Limit traceback to 15 lines
                        error_lines.append("... (truncated) ...")
                        break
        
        # If still no error lines found, just show the last few lines of output
        if not error_lines:
            output_lines = output.split('\n')
            if len(output_lines) > 10:
                error_lines = ["... (output truncated) ..."] + output_lines[-10:]
            else:
                error_lines = output_lines
        
        # Print the error details
        for line in error_lines:
            logger.info(line)
    
    logger.info("\n" + "=" * 60)
    logger.info(f"Total failed test files: {len(failed_tests)}")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_tests()
