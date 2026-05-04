-- Stored Procedure para reabrir un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Reabrir]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Actualizar el palet
    UPDATE Palets
    SET 
        Estado = 'ABIERTO',
        FechaCierre = NULL,
        Observaciones = NULL,
        MedidaCorrectiva = NULL,
        FechaModificacion = GETDATE()
    WHERE 
        Id = @Id;
    
    -- Devolver el palet actualizado
    SELECT 
        p.Id,
        p.Numero,
        p.NumeroPalet,
        p.Estado,
        p.CantidadCajas,
        p.PesoTotal,
        p.PorcentajeAvance,
        p.FormatoId,
        p.ProcesoId,
        p.AcopioId,
        p.FechaCreacion,
        p.FechaCierre,
        p.Observaciones,
        p.MedidaCorrectiva,
        f.Descripcion AS FormatoDescripcion,
        f.LimiteCajasPorPalet,
        a.Codigo AS AcopioCodigo,
        a.Nombre AS AcopioNombre,
        pr.Turno,
        p.NumeroViaje,
        p.PrimeraComposicionFecha
    FROM 
        Palets p
        LEFT JOIN Formatos f ON p.FormatoId = f.Id
        LEFT JOIN Acopios a ON p.AcopioId = a.Id
        LEFT JOIN Procesos pr ON p.ProcesoId = pr.Id
    WHERE 
        p.Id = @Id;
END
