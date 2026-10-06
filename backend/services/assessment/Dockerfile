FROM python:3.12-slim
WORKDIR /srv
COPY libs/kakimetch_common /libs/kakimetch_common
COPY services/assessment/requirements.txt .
RUN pip install --no-cache-dir /libs/kakimetch_common -r requirements.txt
COPY services/assessment/app ./app
USER nobody
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
