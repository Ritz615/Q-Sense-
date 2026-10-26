"""
Queueing theory analytical formulas: M/M/c and Erlang C approximations.
"""
import math


def mmc_expected_waiting_time(arrival_rate: float, service_rate: float, servers: int) -> float:
    """
    Compute expected queue waiting time W_q (in seconds) under M/M/c queueing assumptions.
    arrival_rate: lambda (customers/second)
    service_rate: mu (customers/second per server)
    servers: c (number of active service counters)

    Returns:
      W_q (seconds waiting in queue before service begins)
    """
    if servers <= 0 or service_rate <= 0:
        return float("inf")

    rho = arrival_rate / (servers * service_rate)
    if rho >= 1.0:
        return float("inf")  # Over-saturated / unstable queue

    a = arrival_rate / service_rate  # offered load

    # Compute P0 (probability that system is empty)
    try:
        sum_terms = sum((a ** k) / math.factorial(k) for k in range(servers))
        last_term = (a ** servers) / (math.factorial(servers) * (1.0 - rho))
        p0 = 1.0 / (sum_terms + last_term)
        erlang_c = last_term * p0
        wait_seconds = erlang_c / (servers * service_rate - arrival_rate)
        return max(0.0, wait_seconds)
    except (OverflowError, ZeroDivisionError):
        return float("inf")


def mmc_system_metrics(arrival_rate: float, service_rate: float, servers: int) -> dict:
    """Compute comprehensive M/M/c performance metrics."""
    if servers <= 0 or service_rate <= 0:
        return {
            "rho": 1.0,
            "expected_wait_seconds": float("inf"),
            "expected_queue_length": float("inf"),
            "is_stable": False,
        }

    rho = arrival_rate / (servers * service_rate)
    is_stable = rho < 1.0

    if not is_stable:
        return {
            "rho": min(rho, 2.0),
            "expected_wait_seconds": float("inf"),
            "expected_queue_length": float("inf"),
            "is_stable": False,
        }

    wait_sec = mmc_expected_waiting_time(arrival_rate, service_rate, servers)
    queue_len = arrival_rate * wait_sec  # Little's Law: L_q = lambda * W_q

    return {
        "rho": round(rho, 4),
        "expected_wait_seconds": round(wait_sec, 2),
        "expected_queue_length": round(queue_len, 2),
        "is_stable": True,
    }
