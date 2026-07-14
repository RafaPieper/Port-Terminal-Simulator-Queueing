# ⚓ Port Terminal Queueing Simulator

An interactive, web-based dashboard for container terminal queueing analysis. This application uses the **M/M/c Queuing Theory** model to simulate port capacity, berth utilization, and terminal efficiency based on dynamic user inputs. 

Based on the concepts from the paper: [Teoria das Filas no Planejamento Portuário: Um Estudo de Caso com o Terminal de Contêineres de Salvador](https://www.researchgate.net/publication/398773609_TEORIA_DAS_FILAS_NO_PLANEJAMENTO_PORTUARIO_um_estudo_de_caso_com_o_terminal_de_conteineres_de_Salvador)

## 🌐 Live Demo
**[View the Live Simulator Here](https://RafaPieper.github.io/Port-Terminal-Simulator-Queueing/)**

## ✨ Features
* **Real-time Parameter Adjustment:** Interactive sliders to modify:
  * Expected Throughput (Units/yr)
  * Consignment (Units/Ship)
  * Number of Berths (c)
  * Crane Intensity (per Berth)
  * STS (Ship-to-Shore) Productivity (moves/hr)
* **Visual Terminal Top-Down View:** Dynamic graphical representation of the port, updating instantly as you adjust the number of berths or container volume.
* **Instant Calculations:** Automatically calculates and displays terminal metrics and Yard Fill percentage.



Created by Rafael Pieper