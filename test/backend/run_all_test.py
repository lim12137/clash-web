import os
import subprocess
import glob
import sys


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
        print(f"Installing required packages: {', '.join(packages_to_install)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + packages_to_install)
            return True
        except subprocess.CalledProcessError:
            print(f"Failed to install packages: {', '.join(packages_to_install)}")
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
    
    test_files = []
    
    # Check and collect test files from app directory
    if os.path.exists(app_test_dir):
        app_test_files = glob.glob(os.path.join(app_test_dir, "test_*.py"))
        test_files.extend(app_test_files)
    else:
        print(f"Directory not found: {app_test_dir}")
    
    # Check and collect test files from services directory
    if os.path.exists(services_test_dir):
        services_test_files = glob.glob(os.path.join(services_test_dir, "test_*.py"))
        test_files.extend(services_test_files)
    else:
        print(f"Directory not found: {services_test_dir}")
    
    if not test_files:
        print(f"No test files found in {app_test_dir} or {services_test_dir}")
        return False
    
    print(f"Found {len(test_files)} test files to run")
    print(f"Running tests from project root: {project_root}")
    
    # Change to project root directory
    os.chdir(project_root)
    
    # Install required packages
    if not install_required_packages():
        print("Failed to install required packages. Exiting.")
        return False
    
    # Results tracking
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    test_results = []
    
    # Coverage data file path
    coverage_data_file = os.path.join(current_dir, '.coverage')
    
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
        
        print(f"\nRunning tests in {rel_path}")
        print("-" * 50)
        
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
            "--cov-config=",  # 使用空值而不是 NONE
        ]
        
        # Add omit patterns through environment variable to avoid command line length issues
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{project_root}:{env.get('PYTHONPATH', '')}"
        env["COVERAGE_FILE"] = coverage_data_file
        env["COVERAGE_PROCESS_START"] = "True"
        
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        
        # Print the output
        print(result.stdout)
        if result.stderr:
            print("Errors:")
            print(result.stderr)
        
        # Count tests and results
        test_info = {
            'file': rel_path,
            'success': result.returncode == 0,
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

        total_tests += file_total
        passed_tests += file_passed
        failed_tests += file_failed

    # Generate test summary report
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    # Print per-file results
    for test_result in test_results:
        status = "✅ PASSED" if test_result['success'] else "❌ FAILED"
        print(f"{status} - {test_result['file']}")
    
    # Calculate pass rate
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    print("\nTest Results:")
    print(f"  Total Tests: {total_tests}")
    print(f"  Passed: {passed_tests}")
    print(f"  Failed: {failed_tests}")
    print(f"  Pass Rate: {pass_rate:.1f}%")
    
    # Generate coverage reports
    print("\n" + "=" * 60)
    print("Code Coverage Report")
    print("=" * 60)
    
    try:
        # Use coverage API to generate reports from the collected data
        import coverage
        cov = coverage.Coverage(data_file=coverage_data_file)
        cov.load()
        
        # Console report
        total_coverage = cov.report(show_missing=True)
        print(f"\nTotal Coverage: {total_coverage:.1f}%")
        
        # Generate HTML report
        html_dir = os.path.join(current_dir, 'coverage_html')
        cov.html_report(directory=html_dir)
        print(f"\nHTML coverage report generated in: {html_dir}")
        
        # Generate XML report
        xml_file = os.path.join(current_dir, 'coverage.xml')
        cov.xml_report(outfile=xml_file)
        print(f"XML coverage report generated: {xml_file}")
    except Exception as e:
        if "No data to report" in str(e) or "No data was collected" in str(e):
            print("No coverage data collected. This might be because:")
            print("1. No backend modules were imported during tests")
            print("2. All tested modules are mocked")
            print("3. Tests are not actually calling the backend code")
        else:
            print(f"Error generating coverage report: {e}")
    
    print("\nAll tests completed")
    return True


if __name__ == "__main__":
    run_tests()
