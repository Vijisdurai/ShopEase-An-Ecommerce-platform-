from setuptools import setup, find_packages

setup(
    name="ecommerce",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        'fastapi==0.95.2',
        'uvicorn[standard]==0.21.1',
        'gunicorn==20.1.0',
        'python-multipart==0.0.6',
        'sqlalchemy==1.4.47',
        'alembic==1.10.3',
        'psycopg2-binary==2.9.5',
        'python-jose[cryptography]==3.3.0',
        'passlib[bcrypt]==1.7.4',
        'pydantic==1.10.7',
        'email-validator==1.3.1',
        'python-dotenv==1.0.0',
        'typing-extensions==4.5.0'
    ],
    python_requires='>=3.9,<3.10',
)
