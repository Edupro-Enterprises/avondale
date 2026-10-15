from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = [line for line in f.read().strip().split("\n") if line.strip()]

setup(
    name="edupro_school_fees",
    version="1.0.0",
    description="School Fees & Financial Statements System for Zimbabwean Schools",
    author="Edupro",
    author_email="info@edupro.co.zw",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
